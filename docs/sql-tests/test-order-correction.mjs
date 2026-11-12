// Tests correcting an order after it was placed
// (web/src/lib/orders/correction.ts — the working-out — and
// web/src/lib/orders/correct.ts — reading and writing) against the rebuilt
// database with fixes 42 and 43.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { makeDb, DOCS } from "./harness.mjs";
import { ID, seed } from "./seed.mjs";
import { fakeAdmin } from "./fake-supabase.mjs";
import { loadTs } from "./load-ts.mjs";

const read = (f) => fs.readFileSync(path.join(DOCS, "fixes", f), "utf8");

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log("  ok   " + name);
  else {
    failures++;
    console.log("  FAIL " + name + (detail ? "  -> " + detail : ""));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ 1. working out
console.log("\n== 1. Working out a correction (no database) ==");
{
  const { planCorrection, diffLines, MAX_LINE_QTY } = loadTs("lib/orders/correction.ts");
  const P1 = "p1", P2 = "p2", P3 = "p3";
  const current = [
    { product_id: P1, name: "Нэг", qty: 10, unit_price: 900 },
    { product_id: P2, name: "Хоёр", qty: 5, unit_price: 800 },
  ];
  const catalog = new Map([[P3, { name: "Гурав", price: 3000 }]]);
  const plan = (changes, extra = {}) => planCorrection({ current, currentDiscount: 0, changes, catalog, deals: null, ...extra });
  const qtyOf = (p, id) => p.lines.find((l) => l.product_id === id && l.unit_price > 0)?.qty;

  let p = plan([{ product_id: P1, qty: 8 }]);
  check("another quantity: only that line changes", !p.error && qtyOf(p, P1) === 8 && qtyOf(p, P2) === 5 && p.requantified === 1 && p.changed, JSON.stringify(p));
  check("...and the totals say what it did", p.totalBefore === 13000 && p.totalAfter === 11200, `${p.totalBefore} → ${p.totalAfter}`);

  p = plan([{ product_id: P2, qty: 0 }]);
  check("quantity 0 takes the product off", !p.error && p.lines.length === 1 && p.removed === 1 && p.totalAfter === 9000, JSON.stringify(p));

  p = plan([{ product_id: P3, qty: 2 }]);
  const added = p.lines?.find((l) => l.product_id === P3);
  check("a new product comes in at the store's price of today", !p.error && added?.unit_price === 3000 && added.product_name_snapshot === "Гурав" && p.added === 1, JSON.stringify(p));
  check("...existing lines keep the price they were ordered at", p.lines.find((l) => l.product_id === P1).unit_price === 900);

  p = plan([{ product_id: "unknown", qty: 1 }]);
  check("a product the store isn't sold is refused", !!p.error, JSON.stringify(p));
  p = planCorrection({ current, currentDiscount: 0, changes: [{ product_id: P3, qty: 1 }], catalog: new Map([[P3, { name: "Гурав", price: 0 }]]), deals: null });
  check("a product without a price is refused", !!p.error, JSON.stringify(p));

  p = plan([{ product_id: P1, qty: 0 }, { product_id: P2, qty: 0 }]);
  check("taking everything off is refused (cancel the order instead)", !!p.error, JSON.stringify(p));

  p = plan([{ product_id: P1, qty: 10 }]);
  check("the same quantity again is 'no change'", !p.error && p.changed === false, JSON.stringify(p));

  p = plan([{ product_id: P1, qty: 3 }, { product_id: P1, qty: 4 }]);
  check("one product changed twice in one go is refused", !!p.error);
  check("a negative quantity is refused", !!plan([{ product_id: P1, qty: -1 }]).error);
  check("a quantity that isn't a number is refused", !!plan([{ product_id: P1, qty: Number.NaN }]).error);
  check("an absurd quantity is refused", !!plan([{ product_id: P1, qty: MAX_LINE_QTY + 1 }]).error);
  p = plan([{ product_id: P1, qty: 7.9 }]);
  check("a fraction is cut to whole pieces", !p.error && qtyOf(p, P1) === 7, JSON.stringify(p));

  // An order without deals keeps its discount and gift lines.
  const withGift = [...current, { product_id: P3, name: "🎁 Гурав", qty: 1, unit_price: 0 }];
  p = planCorrection({ current: withGift, currentDiscount: 500, changes: [{ product_id: P1, qty: 9 }], catalog, deals: null });
  check("no deals on the order: discount and gift lines stay", !p.error && p.discountTotal === 500 && p.lines.some((l) => l.unit_price === 0 && l.product_id === P3 && l.qty === 1), JSON.stringify(p));
  p = planCorrection({ current, currentDiscount: 12000, changes: [{ product_id: P2, qty: 0 }], catalog, deals: null });
  check("...but a discount never exceeds what the order is now worth", !p.error && p.discountTotal === 9000 && p.totalAfter === 0, JSON.stringify(p));

  // A store's own order: deals are worked out again.
  p = planCorrection({
    current,
    currentDiscount: 260, // 2% of 13,000
    changes: [{ product_id: P1, qty: 5 }],
    catalog,
    deals: { rules: [], payment: "cash", giftName: () => undefined },
  });
  check("a store's cash order: the 2% follows the new amount", !p.error && Math.round(p.discountTotal) === 170 && Math.round(p.totalAfter) === 8330, JSON.stringify(p));
  const giftRule = { id: "r1", name: "Бэлэг", kind: "threshold_bonus", pct: null, step_amount: 10000, step_qty: null, bonus_n: 1, product_id: P3, category_id: null };
  p = planCorrection({
    current: withGift,
    currentDiscount: 0,
    changes: [{ product_id: P1, qty: 1 }], // 900 + 4,000 = 4,900: under the 10,000 threshold now
    catalog,
    deals: { rules: [giftRule], payment: "credit", giftName: () => "Гурав" },
  });
  check("...a gift the smaller order no longer earns is taken off", !p.error && !p.lines.some((l) => l.unit_price === 0), JSON.stringify(p));
  p = planCorrection({
    current,
    currentDiscount: 0,
    changes: [{ product_id: P1, qty: 20 }], // 18,000 + 4,000
    catalog,
    deals: { rules: [giftRule], payment: "credit", giftName: () => "Гурав" },
  });
  const gift = p.lines?.find((l) => l.unit_price === 0);
  check("...and one it now earns is added", !p.error && gift?.product_id === P3 && gift.qty >= 1 && gift.product_name_snapshot === "🎁 Гурав", JSON.stringify(p));

  const d = diffLines(
    [{ product_id: P1, name: "Нэг", qty: 10, unit_price: 900 }, { product_id: P2, name: "Хоёр", qty: 5, unit_price: 800 }],
    [{ product_id: P1, name: "Нэг", qty: 8, unit_price: 900 }, { product_id: P3, name: "Гурав", qty: 2, unit_price: 3000 }],
  );
  check(
    "the history shows what changed: 10→8, one off, one added",
    d.length === 3 && d.some((x) => x.name === "Нэг" && x.from === 10 && x.to === 8) && d.some((x) => x.name === "Хоёр" && x.to === 0) && d.some((x) => x.name === "Гурав" && x.from === 0 && x.to === 2),
    JSON.stringify(d),
  );
}

// --------------------------------------------------------- 2. with a database
async function freshDb({ fix43 = true } = {}) {
  const { db } = await makeDb();
  await seed(db);
  await db.exec(read("42-all-pending-in-one.sql"));
  if (fix43) await db.exec(read("43-mercury-replacement.sql"));
  globalThis.__bdiAdmin = fakeAdmin(db);
  return db;
}

/** An order the office entered: 10 × p1 @ 900 and 5 × p2 @ 800 for store 1. */
async function staffOrder(db, status = "confirmed") {
  const id = randomUUID();
  await db.query(
    `insert into public.orders (id, order_number, supermarket_id, placed_by, status, payment_method, discount_total)
     values ($1, $2, $3, $4, $5, 'credit', 0)`,
    [id, "ORD-T-" + id.slice(0, 8), ID.s1, ID.admin, status],
  );
  await db.query(
    `insert into public.order_items (order_id, product_id, product_name_snapshot, qty, unit_price)
     values ($1, $2, 'Product 1', 10, 900), ($1, $3, 'Product 2', 5, 800)`,
    [id, ID.p1, ID.p2],
  );
  return id;
}

async function state(db, id) {
  const o = (
    await db.query(
      `select status, subtotal::float8 as subtotal, discount_total::float8 as discount, ordered_total::float8 as ordered,
              to_json(updated_at)#>>'{}' as stamp,
              (select count(*)::int from public.order_changes c where c.order_id = o.id) as changes
         from public.orders o where id = $1`,
      [id],
    )
  ).rows[0];
  const lines = (
    await db.query(
      `select product_id, product_name_snapshot as name, qty, unit_price::float8 as price
         from public.order_items where order_id = $1 order by unit_price desc, product_name_snapshot`,
      [id],
    )
  ).rows;
  return { ...o, lines };
}
const ALL = ["pending", "confirmed", "shipped", "delivered"];

console.log("\n== 2. Correcting an order the office entered ==");
{
  const db = await freshDb();
  const { correctOrder } = loadTs("lib/orders/correct.ts");
  const id = await staffOrder(db);
  const before = await state(db, id);

  let r = await correctOrder({
    orderId: id,
    changes: [{ product_id: ID.p1, qty: 8 }, { product_id: ID.p2, qty: 0 }, { product_id: ID.p3, qty: 2 }],
    reason: "  Хүргэлтээр дутуу  ",
    actorId: ID.admin,
    allowedStatuses: ALL,
    expectedUpdatedAt: before.stamp,
  });
  let s = await state(db, id);
  const p1 = s.lines.find((l) => l.product_id === ID.p1);
  const p3 = s.lines.find((l) => l.product_id === ID.p3);
  check("quantity changed, a product off, a product added — in one step", r.ok && r.changed && s.lines.length === 2 && p1?.qty === 8 && p3?.qty === 2, JSON.stringify({ r, s }));
  check("the added product has the store's price and the product's name", p3?.price === 3000 && p3.name === "Product 3", JSON.stringify(p3));
  check("totals follow: 13,000 → 13,200", s.subtotal === 13200 && r.totalBefore === 13000 && r.totalAfter === 13200, JSON.stringify({ r, s }));
  check("what was ordered is remembered", s.ordered === 13000, String(s.ordered));
  const log = (await db.query(`select changed_by, reason from public.order_changes where order_id = $1`, [id])).rows;
  check("recorded once, with who and why (trimmed)", log.length === 1 && log[0].changed_by === ID.admin && log[0].reason === "Хүргэлтээр дутуу", JSON.stringify(log));

  await sleep(20);
  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 8 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  s = await state(db, id);
  check("saving without a real change writes nothing", r.ok && r.changed === false && s.changes === 1, JSON.stringify({ r, changes: s.changes }));

  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 0 }, { product_id: ID.p3, qty: 0 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  s = await state(db, id);
  check("taking every product off is refused, the order stays", !!r.error && s.lines.length === 2 && s.changes === 1, JSON.stringify({ r, s }));

  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 3 }], reason: null, actorId: ID.admin, allowedStatuses: ALL, expectedUpdatedAt: before.stamp });
  s = await state(db, id);
  check("a screen opened before someone else's change can't overwrite it", !!r.error && /өөрчлөгдсөн/.test(r.error) && s.lines.find((l) => l.product_id === ID.p1).qty === 8, JSON.stringify({ r }));

  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p4, qty: 1 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  check("a product that isn't for sale can't be added", !!r.error && (await state(db, id)).lines.length === 2, JSON.stringify(r));

  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p2, qty: 1 }], reason: null, actorId: ID.admin, allowedStatuses: ALL, mayAddProducts: false });
  check("the delivery screen may not add products", !!r.error && (await state(db, id)).lines.length === 2, JSON.stringify(r));
  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 9 }], reason: "Хүргэлт", actorId: ID.rep, allowedStatuses: ALL, mayAddProducts: false });
  check("...but may change a quantity", r.ok && r.changed && (await state(db, id)).lines.find((l) => l.product_id === ID.p1).qty === 9, JSON.stringify(r));

  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 5 }], reason: null, actorId: ID.admin, allowedStatuses: ["shipped"] });
  check("a caller limited to other statuses is refused", !!r.error && (await state(db, id)).lines.find((l) => l.product_id === ID.p1).qty === 9, JSON.stringify(r));

  // e-Barimt sent: locked until the receipt is returned.
  await db.query(`update public.orders set status = 'shipped' where id = $1`, [id]);
  await db.query(`insert into public.ebarimt_receipts (order_id, status, receipt_type, total_amount, request) values ($1, 'sent', 'B2C_RECEIPT', 1, '{}')`, [id]);
  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 5 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  check("with an e-Barimt sent the order is locked", !!r.error && /Е-баримт/.test(r.error), JSON.stringify(r));
  await db.query(`update public.ebarimt_receipts set status = 'returned' where order_id = $1`, [id]);
  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 5 }], reason: "Буцаалт", actorId: ID.admin, allowedStatuses: ALL });
  s = await state(db, id);
  check("once the receipt is returned it can be corrected (a return)", r.ok && r.changed && s.lines.find((l) => l.product_id === ID.p1).qty === 5 && s.ordered === 13000, JSON.stringify({ r, s }));

  await db.query(`update public.orders set status = 'cancelled' where id = $1`, [id]);
  r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 1 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  check("a cancelled order can't be corrected", !!r.error, JSON.stringify(r));

  r = await correctOrder({ orderId: randomUUID(), changes: [{ product_id: ID.p1, qty: 1 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  check("an order that doesn't exist: a plain 'not found'", !!r.error, JSON.stringify(r));
  r = await correctOrder({ orderId: "nope", changes: [{ product_id: ID.p1, qty: 1 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  check("a made-up id is refused before touching the database", !!r.error, JSON.stringify(r));
}

console.log("\n== 3. Correcting an order a store placed itself (deals follow) ==");
{
  const db = await freshDb();
  const { correctOrder } = loadTs("lib/orders/correct.ts");
  const { computeDiscount } = loadTs("lib/discount.ts");
  const rules = (await db.query(`select id, name, kind, pct::float8 as pct, step_amount::float8 as step_amount, step_qty, bonus_n, product_id, category_id, target_mode, target_price_list_ids from public.discounts`)).rows;

  // Seeded order o1: store 1's own, 2 × p1 @ 900, on credit; the seed has a 5% deal on everything.
  let r = await correctOrder({ orderId: ID.o1, changes: [{ product_id: ID.p1, qty: 4 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  let s = await state(db, ID.o1);
  const want = computeDiscount([{ product_id: ID.p1, qty: 4, unit_price: 900, category_id: null }], "credit", rules).totalDiscount;
  check("the running deal is applied to the new quantity", r.ok && r.changed && want > 0 && Math.abs(s.discount - want) < 0.01, JSON.stringify({ r, discount: s.discount, want }));

  // A gift deal: 1 × p3 free from 3,000₮.
  await db.query(
    `insert into public.discounts (name, kind, step_amount, bonus_n, product_id, active) values ('Бэлэг', 'threshold_bonus', 3000, 1, $1, true)`,
    [ID.p3],
  );
  await sleep(20);
  r = await correctOrder({ orderId: ID.o1, changes: [{ product_id: ID.p1, qty: 10 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  s = await state(db, ID.o1);
  const gift = s.lines.find((l) => l.price === 0);
  check("a gift the corrected order earns is added as a free line", r.ok && gift?.product_id === ID.p3 && gift.name === "🎁 Product 3", JSON.stringify({ r, lines: s.lines }));
  await sleep(20);
  r = await correctOrder({ orderId: ID.o1, changes: [{ product_id: ID.p1, qty: 1 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  s = await state(db, ID.o1);
  check("...and taken off again when the order shrinks below it", r.ok && !s.lines.some((l) => l.price === 0) && s.lines.length === 1, JSON.stringify({ r, lines: s.lines }));
  check("the first ordered amount is still the one remembered", s.ordered === 1800 && s.changes === 3, JSON.stringify({ ordered: s.ordered, changes: s.changes }));
}

console.log("\n== 4. Before fix 43 has been run ==");
{
  const db = await freshDb({ fix43: false });
  const { correctOrder, FIX_43_HINT } = loadTs("lib/orders/correct.ts");
  const id = await staffOrder(db);
  const r = await correctOrder({ orderId: id, changes: [{ product_id: ID.p1, qty: 8 }], reason: null, actorId: ID.admin, allowedStatuses: ALL });
  const lines = (await db.query(`select qty from public.order_items where order_id = $1 and product_id = $2`, [id, ID.p1])).rows;
  check("it says which file to run, and changes nothing", r.error === FIX_43_HINT && lines[0].qty === 10, JSON.stringify({ r, lines }));
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
