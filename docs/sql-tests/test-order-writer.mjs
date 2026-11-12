// Tests the site's order writer (web/src/lib/orders/write.ts) against the
// rebuilt database: a normal send, the same send arriving again, a send
// that dies half-way, and two sends at the same moment. The rule under
// test: one checkout makes ONE order with its lines written ONCE.
//
// ORDER_WRITER=<file> tries another version of the writer against the
// same checks (used to prove the checks catch a broken one).
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { makeDb, DOCS } from "./harness.mjs";
import { ID, seed } from "./seed.mjs";
import { fakeAdmin, KILLED } from "./fake-supabase.mjs";
import { loadTs } from "./load-ts.mjs";

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log("  ok   " + name);
  else {
    failures++;
    console.log("  FAIL " + name + (detail ? "  -> " + detail : ""));
  }
}

// ------------------------------------------------------------------ helpers
const ORDER = {
  supermarket_id: ID.s1,
  placed_by: ID.buyer1,
  notes: "тест",
  payment_method: "credit",
  discount_total: 0,
};
// The same product twice on purpose: a paid line and its free gift line.
const ITEMS = [
  { product_id: ID.p1, product_name_snapshot: "Product 1", qty: 2, unit_price: 900 },
  { product_id: ID.p2, product_name_snapshot: "Product 2", qty: 1, unit_price: 800 },
  { product_id: ID.p1, product_name_snapshot: "🎁 Product 1", qty: 1, unit_price: 0 },
];
const SUBTOTAL = 2 * 900 + 800;

async function state(db, id) {
  const o = await db.query(
    `select order_number, status, subtotal::float8 as subtotal, notes,
            extract(epoch from (now() - created_at))::float8 as age_s,
            (select count(*)::int from public.order_items where order_id = o.id) as lines
       from public.orders o where id = $1`,
    [id],
  );
  return o.rows[0] ?? null;
}

/** Pretend the order was last touched `minutes` ago. */
async function backdate(db, id, minutes) {
  await db.exec(`alter table public.orders disable trigger orders_updated_at`);
  await db.query(
    `update public.orders
        set created_at = created_at - make_interval(mins => $2::int),
            updated_at = updated_at - make_interval(mins => $2::int)
      where id = $1`,
    [id, minutes],
  );
  await db.exec(`alter table public.orders enable trigger orders_updated_at`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A gate: `wait()` blocks until `open()`. */
function gate() {
  let open;
  const p = new Promise((r) => (open = r));
  return { wait: () => p, open };
}

async function scenarios(db, label) {
  console.log(`\n== ${label} ==`);
  const hooks = {};
  globalThis.__bdiAdmin = fakeAdmin(db, hooks);
  const { writeOrder, duplicateInfo } = loadTs(process.env.ORDER_WRITER ?? "lib/orders/write.ts");
  const calm = () => {
    hooks.before = undefined;
    hooks.after = undefined;
  };
  const isLinesInsert = (op, table) => op === "insert" && table === "order_items";

  // 1. A normal send, then the very same send again.
  {
    const id = randomUUID();
    const first = await writeOrder(ORDER, ITEMS, id);
    const s = await state(db, id);
    check("a send makes the order with its lines", !first.error && first.orderId === id && first.duplicate === false && s?.lines === 3, JSON.stringify({ first, s }));
    check("the total is worked out by the database", s?.subtotal === SUBTOTAL, String(s?.subtotal));
    check("order number looks right", /^ORD-\d{4}-\d{5,}$/.test(first.orderNumber ?? ""), first.orderNumber);

    const again = await writeOrder(ORDER, ITEMS, id);
    const s2 = await state(db, id);
    check("the same send again: the same order, nothing written twice", again.duplicate === true && again.orderNumber === first.orderNumber && s2.lines === 3, JSON.stringify({ again, s2 }));
    const info = duplicateInfo(again);
    check("...and it says when the first one was placed", info?.status === "pending" && info.ageMs >= 0 && info.ageMs < 60_000, JSON.stringify(info));

    const stranger = await writeOrder({ ...ORDER, placed_by: ID.buyer2, supermarket_id: ID.s2 }, ITEMS, id);
    check("someone else's checkout id gives nothing away", "error" in stranger && (await state(db, id)).lines === 3, JSON.stringify(stranger));
  }

  // 2. No checkout id: every send is its own order.
  {
    const a = await writeOrder(ORDER, ITEMS, null);
    const b = await writeOrder(ORDER, ITEMS, "not-a-uuid");
    check("without a checkout id each send is a new order", !a.error && !b.error && a.orderId !== b.orderId, JSON.stringify({ a, b }));
  }

  // 3. The lines could not be written (the request never arrived).
  {
    const id = randomUUID();
    hooks.before = (op, table) => {
      if (isLinesInsert(op, table)) throw new Error("connection reset");
    };
    const failed = await writeOrder(ORDER, ITEMS, id);
    calm();
    check("lines failed: an error, and no empty order left behind", "error" in failed && (await state(db, id)) === null, JSON.stringify({ failed, s: await state(db, id) }));
    const retry = await writeOrder(ORDER, ITEMS, id);
    const s = await state(db, id);
    check("...the retry then writes it normally", retry.duplicate === false && s?.lines === 3, JSON.stringify({ retry, s }));
  }

  // 4. The lines WERE written but the answer got lost.
  {
    const id = randomUUID();
    hooks.after = (op, table) => {
      if (isLinesInsert(op, table)) throw new Error("socket hang up");
    };
    const failed = await writeOrder(ORDER, ITEMS, id);
    calm();
    const s = await state(db, id);
    check("answer lost after the lines landed: the order is kept, not deleted", "error" in failed && s?.lines === 3, JSON.stringify({ failed, s }));
    const retry = await writeOrder(ORDER, ITEMS, id);
    const s2 = await state(db, id);
    check("...the retry finds it: already sent, still 3 lines", retry.duplicate === true && s2.lines === 3, JSON.stringify({ retry, s2 }));
  }

  // 5. The server was killed between the order and its lines.
  {
    const id = randomUUID();
    hooks.before = (op, table) => {
      if (isLinesInsert(op, table)) throw KILLED;
    };
    let died = false;
    try {
      await writeOrder(ORDER, ITEMS, id);
    } catch (e) {
      died = e === KILLED;
    }
    calm();
    const shell = await state(db, id);
    check("(setup) a killed send leaves an order with no lines", died && shell?.lines === 0 && shell.status === "pending", JSON.stringify(shell));

    const t0 = Date.now();
    const early = await writeOrder(ORDER, ITEMS, id);
    const waited = Date.now() - t0;
    const s1 = await state(db, id);
    check("a retry right away waits, then says 'not finished yet' — and adds nothing", "error" in early && s1.lines === 0 && waited >= 1900, JSON.stringify({ early, lines: s1.lines, waited }));

    await backdate(db, id, 7);
    const late = await writeOrder({ ...ORDER, notes: "дахин илгээв" }, ITEMS, id);
    const s2 = await state(db, id);
    check("a retry after it is certainly abandoned fills the order in", late.duplicate === false && late.orderId === id && late.orderNumber === shell.order_number && s2.lines === 3 && s2.subtotal === SUBTOTAL, JSON.stringify({ late, s2 }));
    check("...and it counts as placed now, with this send's note", s2.age_s < 60 && s2.notes === "дахин илгээв", JSON.stringify(s2));
    const after = await writeOrder(ORDER, ITEMS, id);
    check("...a further retry: already sent, still 3 lines", after.duplicate === true && (await state(db, id)).lines === 3, JSON.stringify(after));
  }

  // 6. A slow first send, and a second send of the same checkout meanwhile.
  {
    const id = randomUUID();
    const hold = gate();
    let held = 0;
    hooks.before = async (op, table) => {
      if (isLinesInsert(op, table) && held++ === 0) await hold.wait();
    };
    const slow = writeOrder(ORDER, ITEMS, id);
    await sleep(150); // the order row is in, its lines are not
    const second = writeOrder(ORDER, ITEMS, id);
    await sleep(300);
    hold.open();
    const [a, b] = await Promise.all([slow, second]);
    calm();
    const s = await state(db, id);
    check("two sends overlapping: the lines are written once", s?.lines === 3 && s.subtotal === SUBTOTAL, JSON.stringify(s));
    check("...the slow one made it, the other one reports 'already sent'", a.duplicate === false && b.duplicate === true, JSON.stringify({ a, b }));
  }

  // 7. Two retries race to fill the same abandoned order.
  {
    const id = randomUUID();
    hooks.before = (op, table) => {
      if (isLinesInsert(op, table)) throw KILLED;
    };
    await writeOrder(ORDER, ITEMS, id).catch(() => {});
    calm();
    await backdate(db, id, 7);
    // Hold both at the moment they try to claim the order, then let both go.
    const both = gate();
    let arrived = 0;
    hooks.before = async (op, table) => {
      if (op === "update" && table === "orders" && arrived < 2) {
        if (++arrived === 2) both.open();
        await both.wait();
      }
    };
    const [a, b] = await Promise.all([writeOrder(ORDER, ITEMS, id), writeOrder(ORDER, ITEMS, id)]);
    calm();
    const s = await state(db, id);
    const filled = [a, b].filter((r) => r.duplicate === false).length;
    check("two retries at once: exactly one fills it, lines written once", arrived === 2 && filled === 1 && s.lines === 3, JSON.stringify({ a, b, s, arrived }));
  }

  // 8. A first send stuck for minutes finally fails — after a retry finished the order.
  {
    const id = randomUUID();
    const hold = gate();
    let held = 0;
    hooks.before = async (op, table) => {
      if (isLinesInsert(op, table) && held++ === 0) {
        await hold.wait();
        throw new Error("timed out");
      }
    };
    const stuck = writeOrder(ORDER, ITEMS, id);
    await sleep(150);
    await backdate(db, id, 7);
    const retry = await writeOrder(ORDER, ITEMS, id);
    hold.open();
    const first = await stuck;
    calm();
    const s = await state(db, id);
    check("the retry finished the order", retry.duplicate === false && retry.orderId === id, JSON.stringify(retry));
    check("...and the stuck send's clean-up does not delete it", "error" in first && s?.lines === 3, JSON.stringify({ first, s }));
  }

  // 9. The office cancelled the empty order in the meantime.
  {
    const id = randomUUID();
    hooks.before = (op, table) => {
      if (isLinesInsert(op, table)) throw KILLED;
    };
    await writeOrder(ORDER, ITEMS, id).catch(() => {});
    calm();
    await db.query(`update public.orders set status = 'cancelled' where id = $1`, [id]);
    await backdate(db, id, 7);
    const r = await writeOrder(ORDER, ITEMS, id);
    const s = await state(db, id);
    check("a cancelled empty order is left alone and reported as cancelled", r.duplicate === true && duplicateInfo(r)?.status === "cancelled" && s.lines === 0, JSON.stringify({ r, s }));
  }

  // 10. The same checkout arrives twice at the very same moment.
  {
    const id = randomUUID();
    const both = gate();
    let arrived = 0;
    hooks.before = async (op, table) => {
      if (op === "insert" && table === "orders" && arrived < 2) {
        if (++arrived === 2) both.open();
        await both.wait();
      }
    };
    const [a, b] = await Promise.all([writeOrder(ORDER, ITEMS, id), writeOrder(ORDER, ITEMS, id)]);
    calm();
    const s = await state(db, id);
    const made = [a, b].filter((r) => r.duplicate === false).length;
    const dup = [a, b].filter((r) => r.duplicate === true).length;
    check("the same checkout twice at once: one order, lines written once", arrived === 2 && made === 1 && dup === 1 && s?.lines === 3, JSON.stringify({ a, b, s }));
    const n = await db.query(`select count(*)::int as n from public.orders where id = $1`, [id]);
    check("...and only one order row", n.rows[0].n === 1);
  }
}

// ---------------------------------------------------------------------- run
const { db } = await makeDb();
await seed(db);
await scenarios(db, "Order writer — database as it is live today");

// The same again once fix 42 has been run (new order-number function, rules).
try {
  await db.exec(fs.readFileSync(path.join(DOCS, "fixes", "42-all-pending-in-one.sql"), "utf8"));
} catch (e) {
  try { await db.exec("rollback"); } catch {}
  check("fix 42 applies on the test database", false, String(e.message ?? e).split("\n")[0]);
}
await scenarios(db, "Order writer — after fix 42");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
