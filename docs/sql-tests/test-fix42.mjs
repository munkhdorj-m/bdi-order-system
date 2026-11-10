// Tests docs/fixes/42-all-pending-in-one.sql against a local rebuild of the
// live schema (original schema.sql + fixes 01-38 without 32).
import fs from "node:fs";
import path from "node:path";
import { makeDb, asUser, tryQuery, DOCS } from "./harness.mjs";
import { ID, seed } from "./seed.mjs";

const FIX = fs.readFileSync(path.join(DOCS, "fixes", "42-all-pending-in-one.sql"), "utf8");

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log("  ok   " + name);
  else {
    failures++;
    console.log("  FAIL " + name + (detail ? "  -> " + detail : ""));
  }
}


const TABLES = ["categories", "customer_prices", "discounts", "distributors", "ebarimt_receipts", "mercury_records", "notifications", "order_items", "orders", "price_list_items", "price_lists", "products", "profiles", "push_subscriptions", "shipments", "supermarkets", "verify_mn_sessions"];
const ACTORS = {
  admin: { sub: ID.admin },
  inactiveAdmin: { sub: ID.inactiveAdmin },
  rep: { sub: ID.rep },
  buyer1: { sub: ID.buyer1 },
  buyer2: { sub: ID.buyer2 },
  pending: { sub: ID.pending },
};

/** What each actor can SEE in every table (row counts), as one comparable object. */
async function visibility(db) {
  const out = {};
  for (const [name, who] of Object.entries(ACTORS)) {
    out[name] = {};
    for (const t of TABLES) {
      const r = await asUser(db, who, () => tryQuery(db, `select count(*)::int as n from public.${t}`));
      out[name][t] = r.error ? "ERR" : r.rows[0].n;
    }
  }
  return out;
}

function section(from, to) {
  const a = FIX.indexOf(from);
  const b = to ? FIX.indexOf(to) : FIX.length;
  if (a < 0 || b < 0) throw new Error("section marker not found: " + from + " .. " + to);
  return FIX.slice(a, b);
}

// ---------------------------------------------------------------------
console.log("\n== 1. Baseline (live schema as it is today) ==");
{
  const { db, log } = await makeDb();
  check("schema rebuilt", log.every((l) => l.ok), JSON.stringify(log.filter((l) => !l.ok)));
  await seed(db);
  const anon = await asUser(db, { role: "anon" }, () => tryQuery(db, "select count(*)::int as n from public.supermarket_prices"));
  check("today: anonymous CAN read the price view (the hole)", !anon.error && anon.rows[0].n > 0, JSON.stringify(anon));
  const ins = await asUser(db, { sub: ID.buyer1 }, () =>
    tryQuery(db, `insert into public.orders (order_number, supermarket_id, placed_by, status) values ('HACK-1', '${ID.s1}', '${ID.buyer1}', 'delivered') returning id`));
  check("today: a store CAN insert an order as 'delivered' (the hole)", !ins.error && ins.count === 1, JSON.stringify(ins));
  const ia = await asUser(db, { sub: ID.inactiveAdmin }, () => tryQuery(db, "select count(*)::int as n from public.orders"));
  check("today: an inactive admin CAN read every order (the hole)", !ia.error && ia.rows[0].n >= 2, JSON.stringify(ia));
}

// ---------------------------------------------------------------------
console.log("\n== 2. The speed rewrite (section D) changes nothing anyone can see ==");
{
  const { db } = await makeDb();
  await seed(db);
  // Sections 0..C first (they change behaviour on purpose), then snapshot.
  await db.exec("begin;" + section("-- 0. Guard", "-- D. SPEED").replace(/^-- -+\s*$/gm, "") + "commit;");
  const before = await visibility(db);
  const polBefore = (await db.query(`select count(*)::int as n from pg_policies where schemaname='public'`)).rows[0].n;
  await db.exec("begin;" + section("-- D. SPEED", "-- E. PRICES") + "commit;");
  const after = await visibility(db);
  const polAfter = (await db.query(`select count(*)::int as n from pg_policies where schemaname='public'`)).rows[0].n;
  check("same number of rules", polBefore === polAfter, `${polBefore} vs ${polAfter}`);
  check("every actor sees exactly the same rows in every table", JSON.stringify(before) === JSON.stringify(after),
    JSON.stringify({ before, after }));
  const bare = await db.query(`select tablename, policyname, qual, with_check from pg_policies where schemaname='public'`);
  const stillBare = bare.rows.filter((p) => {
    const t = ((p.qual ?? "") + " " + (p.with_check ?? "")).replace(/\(\s*SELECT\s+(auth\.uid|(public\.)?current_role_value|(public\.)?current_supermarket)\(\)\s+AS\s+\w+\s*\)/gi, "");
    return /(auth\.uid|current_role_value|current_supermarket)\(\)/.test(t);
  });
  check("no rule still calls the functions per row", stillBare.length === 0, stillBare.map((p) => p.policyname).join(","));
  console.log("  visibility after:", JSON.stringify(after.admin), "\n               buyer1:", JSON.stringify(after.buyer1), "\n                  rep:", JSON.stringify(after.rep));
}

// ---------------------------------------------------------------------
console.log("\n== 3. The whole file, as the owner will run it ==");
{
  const { db } = await makeDb();
  await seed(db);
  await db.exec(`select cron.schedule('archive-old-terminal-orders', '0 3 * * *', 'delete from orders');`);
  let err = null;
  try { await db.exec(FIX); } catch (e) { err = String(e.message ?? e); try { await db.exec("rollback"); } catch {} }
  check("runs without error", err === null, err ?? "");

  const q = (who, sql) => asUser(db, who, () => tryQuery(db, sql));
  const n = (r) => (r.error ? "ERR:" + r.error : r.rows[0].n);

  // admin
  check("admin sees all orders", n(await q({ sub: ID.admin }, "select count(*)::int as n from public.orders")) === 2);
  check("admin sees store 2 prices", n(await q({ sub: ID.admin }, `select count(*)::int as n from public.supermarket_prices where supermarket_id='${ID.s2}'`)) === 3);
  const adminIns = await q({ sub: ID.admin }, `insert into public.orders (order_number, supermarket_id, placed_by, status) values ('ADM-1', '${ID.s1}', '${ID.admin}', 'pending') returning id`);
  check("admin can still create an order (office entry)", !adminIns.error && adminIns.count === 1, JSON.stringify(adminIns));
  const num = await q({ sub: ID.admin }, "select public.generate_order_number() as v");
  check("order number format", !num.error && /^ORD-\d{4}-\d{5,}$/.test(num.rows[0].v), JSON.stringify(num));

  // inactive admin
  check("inactive admin sees no orders", n(await q({ sub: ID.inactiveAdmin }, "select count(*)::int as n from public.orders")) === 0);
  check("inactive admin sees no prices", n(await q({ sub: ID.inactiveAdmin }, "select count(*)::int as n from public.supermarket_prices")) === 0);
  check("inactive admin cannot update a product", (await q({ sub: ID.inactiveAdmin }, `update public.products set base_price = 1 where id='${ID.p1}' returning id`)).count === 0);

  // store user
  const own = await q({ sub: ID.buyer1 }, `select product_id, effective_price::int as price, price_source from public.supermarket_prices where supermarket_id='${ID.s1}' order by sku`);
  check("store sees its 3 products with the right prices (list 900, override 800, base 3000)",
    !own.error && own.count === 3 && own.rows[0].price === 900 && own.rows[1].price === 800 && own.rows[2].price === 3000, JSON.stringify(own));
  check("store sees nothing of another store's prices", n(await q({ sub: ID.buyer1 }, `select count(*)::int as n from public.supermarket_prices where supermarket_id='${ID.s2}'`)) === 0);
  check("store sees only its own order", n(await q({ sub: ID.buyer1 }, "select count(*)::int as n from public.orders")) === 2 /* own O1 + admin's ADM-1 for the same store */);
  const bIns = await q({ sub: ID.buyer1 }, `insert into public.orders (order_number, supermarket_id, placed_by, status) values ('HACK-2', '${ID.s1}', '${ID.buyer1}', 'pending') returning id`);
  check("store cannot insert an order directly", !!bIns.error && /row-level security/.test(bIns.error), JSON.stringify(bIns));
  const bUpd = await q({ sub: ID.buyer1 }, `update public.orders set discount_total = 999999 where id='${ID.o1}' returning id`);
  check("store cannot change its order's discount", !bUpd.error && bUpd.count === 0, JSON.stringify(bUpd));
  const bItem = await q({ sub: ID.buyer1 }, `insert into public.order_items (order_id, product_id, product_name_snapshot, qty, unit_price) values ('${ID.o1}', '${ID.p3}', 'cheap', 100, 1) returning id`);
  check("store cannot add a line at its own price", !!bItem.error, JSON.stringify(bItem));
  const bItemUpd = await q({ sub: ID.buyer1 }, `update public.order_items set unit_price = 1 where order_id='${ID.o1}' returning id`);
  check("store cannot change a line's price", !bItemUpd.error && bItemUpd.count === 0, JSON.stringify(bItemUpd));
  check("store reads its order lines", n(await q({ sub: ID.buyer1 }, "select count(*)::int as n from public.order_items")) === 1);
  const bNotif = await q({ sub: ID.buyer1 }, `insert into public.notifications (user_id, kind, title) values ('${ID.buyer1}', 'order_new', 'fake') returning id`);
  check("store cannot forge a notification", !!bNotif.error, JSON.stringify(bNotif));
  check("store reads its own notifications", n(await q({ sub: ID.buyer1 }, "select count(*)::int as n from public.notifications")) === 1);
  check("store can mark its notification read", (await q({ sub: ID.buyer1 }, "update public.notifications set read_at = now() returning id")).count === 1);
  check("store sees running deals", n(await q({ sub: ID.buyer1 }, "select count(*)::int as n from public.discounts")) === 1);

  // rep
  check("rep sees their store's prices", n(await q({ sub: ID.rep }, `select count(*)::int as n from public.supermarket_prices where supermarket_id='${ID.s1}'`)) === 3);
  check("rep sees nothing of a store that isn't theirs", n(await q({ sub: ID.rep }, `select count(*)::int as n from public.supermarket_prices where supermarket_id='${ID.s2}'`)) === 0);
  check("rep sees their store's orders", n(await q({ sub: ID.rep }, "select count(*)::int as n from public.orders")) === 2);
  const rIns = await q({ sub: ID.rep }, `insert into public.orders (order_number, supermarket_id, placed_by, status) values ('HACK-3', '${ID.s1}', '${ID.rep}', 'pending') returning id`);
  check("rep cannot insert an order directly", !!rIns.error, JSON.stringify(rIns));

  // pending sign-up (inactive buyer without a store)
  check("pending sign-up sees no prices", n(await q({ sub: ID.pending }, "select count(*)::int as n from public.supermarket_prices")) === 0);
  check("pending sign-up reads own profile", n(await q({ sub: ID.pending }, "select count(*)::int as n from public.profiles")) === 1);

  // anonymous
  const anon = await q({ role: "anon" }, "select count(*)::int as n from public.supermarket_prices");
  check("anonymous cannot read prices", !!anon.error || anon.rows[0].n === 0, JSON.stringify(anon));
  check("anonymous sees no deals", n(await q({ role: "anon" }, "select count(*)::int as n from public.discounts")) === 0);
  const anonNum = await q({ role: "anon" }, "select public.generate_order_number() as v");
  check("anonymous cannot take order numbers", !!anonNum.error, JSON.stringify(anonNum));

  // service role (the website's server)
  check("server sees every active store's prices", n(await q({ role: "service_role" }, "select count(*)::int as n from public.supermarket_prices")) === 6);
  const sIns = await q({ role: "service_role" }, `insert into public.orders (order_number, supermarket_id, placed_by, status) values ('SRV-1', '${ID.s2}', '${ID.buyer2}', 'pending') returning id`);
  check("server can write orders", !sIns.error && sIns.count === 1, JSON.stringify(sIns));
  const sNum = await q({ role: "service_role" }, "select public.generate_order_number() as v");
  check("server can take order numbers", !sNum.error, JSON.stringify(sNum));
  check("server can insert notifications", !(await q({ role: "service_role" }, `insert into public.notifications (user_id, kind, title) values ('${ID.buyer1}', 'order_new', 'real') returning id`)).error);

  // jobs
  const jobs = await db.query("select jobname from cron.job order by 1");
  const names = jobs.rows.map((j) => j.jobname);
  check("the order-deleting and dead OTP jobs are gone; the purge job exists",
    !names.includes("archive-old-terminal-orders") && !names.includes("cleanup-phone-otp") && names.includes("purge-verify-mn-sessions"), JSON.stringify(names));
  check("self-test left no test order behind", (await db.query("select count(*)::int as n from public.orders where order_number like 'SELF-TEST-%'")).rows[0].n === 0);
  check("role is back to the owner", (await db.query("select current_user::text as u")).rows[0].u === "postgres");

  // run it again
  const dump = async () => JSON.stringify((await db.query(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' order by 1,2`)).rows);
  const d1 = await dump();
  let err2 = null;
  try { await db.exec(FIX); } catch (e) { err2 = String(e.message ?? e); try { await db.exec("rollback"); } catch {} }
  check("running it a second time works", err2 === null, err2 ?? "");
  check("…and changes no rule", d1 === (await dump()));
  const res = await db.query(FIX.slice(FIX.lastIndexOf("select 'order rules'")));
  console.log("  final report rows:", res.rows.map((r) => `${r.what}: ${r.value}`).join(" | "));
}

// ---------------------------------------------------------------------
console.log("\n== 4. A failing check undoes everything ==");
{
  const { db } = await makeDb();
  await seed(db);
  // An unexpected hand-made write rule must stop the whole file.
  await db.exec(`create policy sneaky on public.orders for update using (true);`);
  let err = null;
  try { await db.exec(FIX); } catch (e) { err = String(e.message ?? e).split("\n")[0]; try { await db.exec("rollback"); } catch {} }
  check("stops with a clear message", !!err && /Unexpected write rules on orders/.test(err), err ?? "no error");
  const still = await db.query(`select count(*)::int as n from pg_policies where schemaname='public' and policyname='orders_buyer_insert'`);
  check("nothing was changed (old rules still there)", still.rows[0].n === 1);
  const fn = await db.query(`select prosrc from pg_proc where proname='current_role_value'`);
  check("…including the role function", !/and active/.test(fn.rows[0].prosrc));
}

// ---------------------------------------------------------------------
console.log("\n== 5. Other starting points ==");
async function runFix(db) {
  try {
    await db.exec(FIX);
    return null;
  } catch (e) {
    try { await db.exec("rollback"); } catch {}
    return String(e.message ?? e).split("\n")[0];
  }
}
{
  // (a) fixes 39, 40 and 41 had already been run one by one
  const { db } = await makeDb();
  await seed(db);
  const applied = [];
  for (const f of ["39-orders-server-only-writes.sql", "40-inactive-users-lose-access.sql", "41-sms-limits-crons-order-number.sql"]) {
    try {
      await db.exec(fs.readFileSync(path.join(DOCS, "fixes", f), "utf8"));
      applied.push(f);
    } catch (e) {
      try { await db.exec("rollback"); } catch {}
      applied.push(f + " FAILED: " + String(e.message ?? e).split("\n")[0]);
    }
  }
  check("39, 40, 41 each apply on their own", applied.every((x) => !x.includes("FAILED")), applied.join(" | "));
  const err = await runFix(db);
  check("(a) after 39-41 were already run: works", err === null, err ?? "");
}
{
  // (b) nobody but one admin; no stores, no products
  const { db } = await makeDb();
  await db.query(`insert into auth.users (id, phone) values ($1, '97699000000')`, [ID.admin]);
  await db.query(`insert into public.profiles (id, role, active) values ($1, 'admin', true) on conflict (id) do update set role = 'admin', active = true`, [ID.admin]);
  const err = await runFix(db);
  check("(b) almost empty database: works", err === null, err ?? "");
}
{
  // (c) no active admin at all: must refuse
  const { db } = await makeDb();
  const err = await runFix(db);
  check("(c) no active admin: refuses to run", !!err && /no ACTIVE admin/.test(err), err ?? "no error");
}
{
  // (d) pg_cron not installed
  const { db } = await makeDb();
  await seed(db);
  await db.exec("drop schema cron cascade;");
  const err = await runFix(db);
  check("(d) without pg_cron: works", err === null, err ?? "");
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
