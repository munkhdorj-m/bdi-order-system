/**
 * Working out a correction to an order — pure, no I/O, so it can be
 * checked on its own (docs/sql-tests/test-order-correction.mjs).
 *
 * A correction is a short list of "this product: this many" (0 = take it
 * off; a product the order doesn't have = add it). Everything not
 * mentioned stays as it is. Prices of lines already on the order never
 * change — the store agreed to them when it ordered; a newly added
 * product gets the store's price of today.
 */

import { computeDiscount, type DiscountRule } from "@/lib/discount";
import type { PaymentMethod } from "@/lib/payment-method";

/** A line as the order has it now. `unit_price` 0 = a free gift line. */
export type CurrentLine = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  category_id?: string | null;
};

export type LineChange = { product_id: string; qty: number };

/** What a product costs this store today (only needed for products being added). */
export type CatalogEntry = { name: string; price: number; category_id?: string | null };

export type PlannedLine = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
  unit_price: number;
};

export type CorrectionPlan = {
  /** The complete new list of lines (paid lines, then gifts). */
  lines: PlannedLine[];
  discountTotal: number;
  /** false = the "correction" changes nothing; don't write it. */
  changed: boolean;
  totalBefore: number;
  totalAfter: number;
  added: number;
  removed: number;
  requantified: number;
};

/** Most pieces of one product on one order — a typing slip (99999999) stops here. */
export const MAX_LINE_QTY = 100_000;
/** Most different products on one order (same limit as order entry). */
export const MAX_LINES = 300;

const GIFT_PREFIX = "🎁 ";

export function planCorrection(input: {
  current: CurrentLine[];
  currentDiscount: number;
  changes: LineChange[];
  /** Today's price and name of every product being ADDED. */
  catalog: Map<string, CatalogEntry>;
  /**
   * Deals to work out again from the corrected lines (orders a store
   * placed itself). `null` = the order has no deals: its discount and
   * gift lines stay as they are.
   */
  deals: {
    rules: DiscountRule[];
    payment: PaymentMethod;
    /** Name of a gift product, for its "🎁 …" line. */
    giftName: (productId: string) => string | undefined;
  } | null;
}): CorrectionPlan | { error: string } {
  const paidNow = input.current.filter((l) => Number(l.unit_price) > 0);
  const giftsNow = input.current.filter((l) => Number(l.unit_price) === 0);

  // One paid line per product (an order normally has it that way already).
  const paid = new Map<string, CurrentLine>();
  for (const l of paidNow) {
    const seen = paid.get(l.product_id);
    if (seen) seen.qty += Number(l.qty);
    else paid.set(l.product_id, { ...l, qty: Number(l.qty), unit_price: Number(l.unit_price) });
  }
  const before = new Map([...paid].map(([id, l]) => [id, l.qty]));

  let added = 0;
  let removed = 0;
  let requantified = 0;
  const seenChange = new Set<string>();
  for (const c of input.changes) {
    if (!c || typeof c.product_id !== "string" || !c.product_id) return { error: "Бараа олдсонгүй." };
    if (seenChange.has(c.product_id)) return { error: "Нэг барааг хоёр удаа өөрчилсөн байна. Хуудсаа сэргээнэ үү." };
    seenChange.add(c.product_id);
    const qty = Math.floor(Number(c.qty));
    if (!Number.isFinite(qty) || qty < 0) return { error: "Тоо хэмжээ буруу байна." };
    if (qty > MAX_LINE_QTY) return { error: `Нэг барааны тоо ${MAX_LINE_QTY.toLocaleString("en-US")}-аас ихгүй байна.` };

    const line = paid.get(c.product_id);
    if (line) {
      if (qty === 0) {
        paid.delete(c.product_id);
        removed += 1;
      } else if (qty !== line.qty) {
        line.qty = qty;
        requantified += 1;
      }
      continue;
    }
    if (qty === 0) continue; // taking off something that isn't there
    const entry = input.catalog.get(c.product_id);
    if (!entry) return { error: "Нэмэх бараа энэ дэлгүүрийн үнийн жагсаалтад алга." };
    if (!(Number(entry.price) > 0)) return { error: `«${entry.name}» бараанд үнэ тогтоогоогүй байна.` };
    paid.set(c.product_id, {
      product_id: c.product_id,
      name: entry.name,
      qty,
      unit_price: Number(entry.price),
      category_id: entry.category_id ?? null,
    });
    added += 1;
  }

  if (paid.size === 0) {
    return { error: "Захиалгад дор хаяж нэг бараа үлдэх ёстой. Бүгдийг хасах бол захиалгыг цуцална уу." };
  }
  if (paid.size > MAX_LINES) return { error: `Нэг захиалгад ${MAX_LINES}-аас олон бараа оруулах боломжгүй.` };

  const paidLines = [...paid.values()];
  const gross = paidLines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  let discountTotal: number;
  let gifts: PlannedLine[];
  if (input.deals) {
    const deal = computeDiscount(
      paidLines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        unit_price: l.unit_price,
        category_id: l.category_id ?? null,
      })),
      input.deals.payment,
      input.deals.rules,
    );
    discountTotal = deal.totalDiscount;
    const want = new Map<string, number>();
    for (const b of deal.bonuses) want.set(b.product_id, (want.get(b.product_id) ?? 0) + b.qty);
    gifts = [...want]
      .filter(([, qty]) => qty > 0)
      .map(([product_id, qty]) => ({
        product_id,
        product_name_snapshot: `${GIFT_PREFIX}${input.deals!.giftName(product_id) ?? "Бэлэг бараа"}`,
        qty,
        unit_price: 0,
      }));
  } else {
    // No deals on this order: what was taken off before stays, but never
    // more than the order is now worth.
    discountTotal = Math.min(Math.max(0, Number(input.currentDiscount) || 0), gross);
    gifts = giftsNow.map((g) => ({
      product_id: g.product_id,
      product_name_snapshot: g.name,
      qty: Number(g.qty),
      unit_price: 0,
    }));
  }

  const lines: PlannedLine[] = [
    ...paidLines.map((l) => ({
      product_id: l.product_id,
      product_name_snapshot: l.name,
      qty: l.qty,
      unit_price: l.unit_price,
    })),
    ...gifts,
  ];

  const grossBefore = paidNow.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0);
  const discountBefore = Math.max(0, Number(input.currentDiscount) || 0);
  const key = (l: { product_id: string; qty: number; unit_price: number }) =>
    `${l.product_id}|${Number(l.unit_price)}|${Number(l.qty)}`;
  const was = [
    ...[...before].map(([product_id, qty]) => key({ product_id, qty, unit_price: paidNow.find((l) => l.product_id === product_id)!.unit_price })),
    ...mergeGifts(giftsNow).map(key),
  ].sort();
  const now = [...lines.filter((l) => l.unit_price > 0).map(key), ...mergeGifts(gifts.map((g) => ({ ...g, name: g.product_name_snapshot }))).map(key)].sort();
  const sameLines = was.length === now.length && was.every((k, i) => k === now[i]);
  const changed = !sameLines || Math.round(discountTotal * 100) !== Math.round(discountBefore * 100);

  return {
    lines,
    discountTotal,
    changed,
    totalBefore: Math.max(0, grossBefore - discountBefore),
    totalAfter: Math.max(0, gross - discountTotal),
    added,
    removed,
    requantified,
  };
}

/** Gift lines per product (two "🎁" rows of one product count as one). */
function mergeGifts(gifts: { product_id: string; qty: number }[]): { product_id: string; qty: number; unit_price: number }[] {
  const m = new Map<string, number>();
  for (const g of gifts) m.set(g.product_id, (m.get(g.product_id) ?? 0) + Number(g.qty));
  return [...m].map(([product_id, qty]) => ({ product_id, qty, unit_price: 0 }));
}

/** One product's quantity in a recorded change, for the history list. */
export type LineDiff = { name: string; from: number; to: number; unitPrice: number };

/**
 * What changed between two recorded line lists (order_changes.lines_before
 * / lines_after): one row per product and price whose quantity differs.
 */
export function diffLines(
  before: { product_id: string; name: string; qty: number; unit_price: number }[],
  after: { product_id: string; name: string; qty: number; unit_price: number }[],
): LineDiff[] {
  const index = (rows: typeof before) => {
    const m = new Map<string, { name: string; qty: number; unitPrice: number }>();
    for (const r of rows ?? []) {
      const k = `${r.product_id}|${Number(r.unit_price) > 0 ? "paid" : "gift"}`;
      const cur = m.get(k);
      if (cur) cur.qty += Number(r.qty);
      else m.set(k, { name: r.name, qty: Number(r.qty), unitPrice: Number(r.unit_price) });
    }
    return m;
  };
  const a = index(before);
  const b = index(after);
  const out: LineDiff[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const from = a.get(k)?.qty ?? 0;
    const to = b.get(k)?.qty ?? 0;
    if (from === to) continue;
    const ref = b.get(k) ?? a.get(k)!;
    out.push({ name: ref.name, from, to, unitPrice: ref.unitPrice });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, "mn"));
}
