// Tests docs/fixes/43-mercury-replacement.sql against a local rebuild of
// the live schema (schema + fixes 01-38, then 42 — what is live today).
import fs from "node:fs";
import path from "node:path";
import { makeDb, asUser, tryQuery, DOCS } from "./harness.mjs";
import { ID, seed } from "./seed.mjs";

const read = (f) => fs.readFileSync(path.join(DOCS, "fixes", f), "utf8");
const FIX42 = read("42-all-pending-in-one.sql");
const FIX43 = read("43-mercury-replacement.sql");
const SIG = "public.replace_order_lines(uuid, jsonb, numeric, uuid, text, timestamptz)";

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log("  ok   " + name);
  else {
    failures++;
    console.log("  FAIL " + name + (detail ? "  -> " + detail : ""));
  }
}

async function run(db, sql) {
  try {
    const results = await db.exec(sql);
    return { error: null, last: results.at(-1) };
  } catch (e) {
    try { await db.exec("rollback"); } catch {}
    return { error: String(e.message ?? e).split("\n")[0], last: null };
  }
}

const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];
const has = async (db) => ({
  ordered: (await one(db, `select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='orders' and column_name='ordered_total'`)).n === 1,
  changes: (await one(db, `select to_regclass('public.order_changes') is not null as y`)).y,
  fn: (await one(db, `select to_regprocedure('${SIG}') is not null as y`)).y,
  link: (await one(db, `select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='distributors' and column_name='profile_id'`)).n === 1,
});
const line = (product, name, qty, price) => ({ product_id: product, product_name_snapshot: name, qty, unit_price: price });
const call = (db, order, lines, discount, stamp = null, who = ID.admin, reason = "тест") =>
  tryQuery(db, `select public.replace_order_lines($1::uuid, $2::jsonb, $3::numeric, $4::uuid, $5::text, $6::timestamptz) as r`, [
    order,
    JSON.stringify(lines),
    discount,
    who,
    reason,
    stamp,
  ]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("\n== 1. The whole file, on the database as it is live today ==");
{
  const { db } = await makeDb();
  await seed(db);
  const r42 = await run(db, FIX42);
  check("(setup) fix 42 applies", !r42.error, r42.error ?? "");
  const before = await one(db, `select (select count(*) from public.orders)::int as orders, (select count(*) from public.order_items)::int as items, (select count(*) from public.ebarimt_receipts)::int as receipts`);

  const r = await run(db, FIX43);
  check("fix 43 runs without an error", !r.error, r.error ?? "");
  const h = await has(db);
  check("everything it adds is there", h.ordered && h.changes && h.fn && h.link, JSON.stringify(h));
  const report = r.last?.rows ?? [];
  check("its final report says so", report.length === 4 && report.every((x) => x.present === "true"), JSON.stringify(report));

  const after = await one(db, `select (select count(*) from public.orders)::int as orders, (select count(*) from public.order_items)::int as items, (select count(*) from public.ebarimt_receipts)::int as receipts, (select count(*) from public.order_changes)::int as changes, (select count(*) from public.orders where order_number like 'SELF-TEST-%')::int as leftovers`);
  check(
    "its self-test leaves nothing behind",
    after.orders === before.orders && after.items === before.items && after.receipts === before.receipts && after.changes === 0 && after.leftovers === 0,
    JSON.stringify({ before, after }),
  );

  // Who may do what.
  const asBuyer = await asUser(db, { sub: ID.buyer1 }, () => call(db, ID.o1, [line(ID.p1, "Product 1", 1, 900)], 0));
  check("a store account cannot call the correction function", !!asBuyer.error && /permission denied/i.test(asBuyer.error), JSON.stringify(asBuyer));
  const asAnon = await asUser(db, { role: "anon" }, () => call(db, ID.o1, [line(ID.p1, "Product 1", 1, 900)], 0));
  check("a visitor cannot call it either", !!asAnon.error && /permission denied/i.test(asAnon.error), JSON.stringify(asAnon));
  const stillTwo = await one(db, `select qty from public.order_items where order_id = $1`, [ID.o1]);
  check("...and the order is untouched", stillTwo.qty === 2, JSON.stringify(stillTwo));

  // The server (service role) corrects the seeded order: 2 × p1 → 1 × p1 + 2 × p2.
  const stamp = (await one(db, `select to_json(updated_at)#>>'{}' as s from public.orders where id = $1`, [ID.o1])).s;
  await db.exec("set role service_role");
  const ok = await call(db, ID.o1, [line(ID.p1, "Product 1", 1, 900), line(ID.p2, "Product 2", 2, 800)], 0, stamp, ID.admin, "хүргэлтээр дутуу");
  await db.exec("reset role");
  const o = await one(db, `select subtotal::float8 as subtotal, discount_total::float8 as discount, ordered_total::float8 as ordered from public.orders where id = $1`, [ID.o1]);
  const items = (await db.query(`select product_id, qty, unit_price::float8 as price from public.order_items where order_id = $1 order by unit_price desc`, [ID.o1])).rows;
  check("the server can: lines replaced, totals follow", !ok.error && ok.rows[0].r.ok === true && items.length === 2 && o.subtotal === 2500, JSON.stringify({ ok, o, items }));
  check("what was ordered is kept", o.ordered === 1800, JSON.stringify(o));
  const log = (await db.query(`select changed_by, reason, total_before::float8 as b, total_after::float8 as a, lines_before, lines_after from public.order_changes where order_id = $1`, [ID.o1])).rows;
  check(
    "the change is recorded (who, why, before and after)",
    log.length === 1 && log[0].changed_by === ID.admin && log[0].reason === "хүргэлтээр дутуу" && log[0].b === 1800 && log[0].a === 2500 && log[0].lines_before.length === 1 && log[0].lines_after.length === 2,
    JSON.stringify(log),
  );

  // A copy of the order from before that correction is refused.
  await sleep(20);
  await db.exec("set role service_role");
  const stale = await call(db, ID.o1, [line(ID.p1, "Product 1", 5, 900)], 0, stamp);
  await db.exec("reset role");
  check("a correction based on an old copy of the order is refused", stale.rows?.[0]?.r?.error === "changed", JSON.stringify(stale));

  // History: admins read it, stores and visitors don't.
  const adminSees = await asUser(db, { sub: ID.admin }, () => tryQuery(db, `select count(*)::int as n from public.order_changes`));
  const buyerSees = await asUser(db, { sub: ID.buyer1 }, () => tryQuery(db, `select count(*)::int as n from public.order_changes`));
  const anonSees = await asUser(db, { role: "anon" }, () => tryQuery(db, `select count(*)::int as n from public.order_changes`));
  check("an admin can read the history", adminSees.rows?.[0]?.n === 1, JSON.stringify(adminSees));
  check("a store account sees none of it", buyerSees.rows?.[0]?.n === 0, JSON.stringify(buyerSees));
  check("a visitor is refused", !!anonSees.error, JSON.stringify(anonSees));
  const buyerWrites = await asUser(db, { sub: ID.admin }, () =>
    tryQuery(db, `insert into public.order_changes (order_id, total_before, total_after, lines_before, lines_after) values ($1, 0, 0, '[]', '[]')`, [ID.o1]),
  );
  check("nobody but the server writes the history (not even an admin's browser)", !!buyerWrites.error, JSON.stringify(buyerWrites));

  // One delivery person per login.
  await db.query(`update public.distributors set profile_id = $1 where name = 'Мөнхөө'`, [ID.rep]);
  const second = await tryQuery(db, `insert into public.distributors (name, profile_id) values ('Хоёр дахь', $1)`, [ID.rep]);
  check("a login can be linked to one delivery person only", !!second.error && /duplicate|unique/i.test(second.error), JSON.stringify(second));
  const unlinked = await tryQuery(db, `insert into public.distributors (name) values ('Гурав дахь'), ('Дөрөв дэх')`);
  check("...while any number may have no login", !unlinked.error, JSON.stringify(unlinked));

  // Running it again changes nothing.
  const again = await run(db, FIX43);
  const o2 = await one(db, `select ordered_total::float8 as ordered, (select count(*) from public.order_changes)::int as changes, (select profile_id from public.distributors where name = 'Мөнхөө') as linked from public.orders where id = $1`, [ID.o1]);
  check("running it twice is harmless", !again.error && o2.ordered === 1800 && o2.changes === 1 && o2.linked === ID.rep, JSON.stringify({ again: again.error, o2 }));
}

console.log("\n== 2. A failing check undoes everything ==");
{
  const { db } = await makeDb();
  await seed(db);
  await run(db, FIX42);
  // Break it: leave the function callable by everyone.
  const revoke = `revoke execute on function ${SIG}\n  from public, anon, authenticated;`;
  check("(setup) the statement to break is in the file", FIX43.includes(revoke));
  const broken = FIX43.replace(revoke, "");
  const r = await run(db, broken);
  const h = await has(db);
  check("the self-test stops it", !!r.error && /Self-test failed/.test(r.error), r.error ?? "(no error)");
  check("...and nothing was changed", !h.ordered && !h.changes && !h.fn && !h.link, JSON.stringify(h));
}

console.log("\n== 3. Other starting points ==");
{
  // Before fix 37 (no delivery runs, no e-Barimt table): refuses, says why.
  const { db } = await makeDb({ upTo: 36 });
  await seed(db);
  const r = await run(db, FIX43);
  const h = await has(db);
  check("without fix 37 it refuses to run and says which file is missing", !!r.error && /37-dispatch-and-ebarimt/.test(r.error), r.error ?? "(no error)");
  check("...changing nothing", !h.ordered && !h.changes && !h.fn, JSON.stringify(h));
}
{
  // Fix 42 not run yet (39-41 neither): still fine.
  const { db } = await makeDb();
  await seed(db);
  const r = await run(db, FIX43);
  const h = await has(db);
  check("before fix 42: works", !r.error && h.ordered && h.changes && h.fn && h.link, r.error ?? JSON.stringify(h));
}
{
  // An empty database (no store, admin or products): the self-test steps aside.
  const { db } = await makeDb();
  const r = await run(db, FIX43);
  const h = await has(db);
  check("on an empty database: works (self-test skipped)", !r.error && h.fn, r.error ?? JSON.stringify(h));
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
