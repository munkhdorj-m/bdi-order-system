/**
 * Discount engine — single source of truth for how prices get reduced
 * between "list price × qty" and "the number the buyer actually pays".
 *
 * Two persisted discount kinds (see docs/fixes/21-discounts.sql):
 *
 *   - product         — N% off a target product / category / all
 *   - threshold_bonus — when SUBTOTAL ≥ step_amount, buyer gets
 *                       bonus_n free of product_id
 *
 * Plus a built-in cash discount applied when the buyer chooses cash
 * payment at checkout.
 *
 * Stacking model: COMPOUND. Each step applies to the running
 * subtotal of the previous step. Order: product → cash. Bonus
 * rules don't change the total — they emit a free-item line shown
 * separately in the cart summary.
 */

import type { PaymentMethod } from "./payment-method";

/** Cash-on-delivery / cash-up-front gives this fraction off the total. */
export const CASH_DISCOUNT_PCT = 0.02;

export type DiscountKind = "product" | "threshold_bonus";

export type CartLine = {
  product_id: string;
  qty: number;
  unit_price: number;
  /** Optional — only required by per-product/category discount matching. */
  category_id?: string | null;
};

export type DiscountBreakdown = {
  /** SUM(qty * unit_price) — what the buyer would owe with no discounts. */
  gross: number;
  /** Total amount knocked off across all discount steps. */
  totalDiscount: number;
  /** gross - totalDiscount — what the buyer actually pays. */
  net: number;
  /** Itemized breakdown so the UI can show "Cash 2% : -1,000₮". */
  steps: DiscountStep[];
  /** Bonus-product lines triggered (qty of free items per product). */
  bonuses: DiscountBonus[];
};

export type DiscountStep = {
  kind: "product" | "cash";
  label: string;
  amount: number; // amount removed at this step
};

export type DiscountBonus = {
  product_id: string;
  qty: number;
  source_discount_id: string;
  label: string;
};

/**
 * Persisted-discount row shape (mirrors public.discounts). Kept as a
 * loose type rather than imported from supabase-js so this file stays
 * usable from the client bundle without dragging the DB types graph.
 */
export type DiscountTargetMode = "all" | "include" | "exclude";

export type DiscountRule = {
  id: string;
  name: string;
  kind: DiscountKind | string; // tolerate legacy enum values like 'bulk'/'bonus'
  pct: number | null;
  /** kind=threshold_bonus: subtotal threshold; legacy bulk: step size */
  step_amount: number | null;
  /** legacy bonus column; not used by the new engine */
  step_qty: number | null;
  /** kind=threshold_bonus: how many free items per crossing */
  bonus_n: number | null;
  product_id: string | null;
  category_id: string | null;
  ends_at?: string | null;
  /** Store targeting via price lists (fix 30). Absent on old fetches →
   *  treated as 'all' so untargeted rules keep applying everywhere. */
  target_mode?: DiscountTargetMode | string | null;
  target_price_list_ids?: string[] | null;
};

/**
 * Does this rule apply to a store on the given price list?
 *
 *   all      → yes, always
 *   include  → only if the store's price list is in the target set
 *   exclude  → only if it ISN'T (stores without a price list count as
 *              "not in the set", so they match exclude-mode rules)
 */
export function ruleAppliesToPriceList(
  rule: DiscountRule,
  priceListId: string | null,
): boolean {
  const mode = rule.target_mode ?? "all";
  if (mode !== "include" && mode !== "exclude") return true;
  const ids = rule.target_price_list_ids ?? [];
  const inSet = priceListId !== null && ids.includes(priceListId);
  return mode === "include" ? inSet : !inSet;
}

/** Filter a rule set down to what applies for one store's price list. */
export function rulesForPriceList(
  rules: DiscountRule[],
  priceListId: string | null,
): DiscountRule[] {
  return rules.filter((r) => ruleAppliesToPriceList(r, priceListId));
}

export function gross(lines: CartLine[]): number {
  let sum = 0;
  for (const l of lines) sum += l.qty * l.unit_price;
  return sum;
}

/**
 * Per-product (or per-category, or all-products) discounts. Each rule
 * runs against the cart and contributes an aggregated `amount` to the
 * steps list. Computed independently against the line's gross — that's
 * the "compound" stacking model: if two product rules happen to match
 * the same line they're each applied at their stated pct rather than
 * one-after-the-other on the same line.
 */
function applyProductRules(
  lines: CartLine[],
  rules: DiscountRule[],
): { steps: DiscountStep[]; reduced: number } {
  const steps: DiscountStep[] = [];
  let reduced = 0;
  for (const r of rules) {
    if (r.kind !== "product") continue;
    const pct = num(r.pct);
    if (pct === null || pct <= 0) continue;
    let amt = 0;
    for (const l of lines) {
      const matchesProduct =
        !r.product_id || r.product_id === l.product_id;
      const matchesCategory =
        !r.category_id || r.category_id === l.category_id;
      // Both filters must pass; nulls mean "no filter on this dimension".
      if (matchesProduct && matchesCategory) {
        amt += l.qty * l.unit_price * (pct / 100);
      }
    }
    amt = Math.round(amt);
    if (amt > 0) {
      steps.push({
        kind: "product",
        label: `${r.name} (${pct}%)`,
        amount: amt,
      });
      reduced += amt;
    }
  }
  return { steps, reduced };
}

/**
 * Coerce PostgREST-returned numerics to JS numbers. Supabase returns
 * `numeric(14,2)` columns as STRINGS by default (to preserve precision),
 * which makes `value < threshold` do lexicographic comparison silently.
 * Always run any DB number through this before arithmetic.
 */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Threshold-bonus rules — when the current running subtotal reaches
 * `step_amount`, the buyer gets `bonus_n` free of `product_id`. Each
 * rule fires at most once per cart (single-tier threshold, not a
 * stacking step). Returns the bonus lines as display-only — the cart
 * total isn't affected because the bonus is free.
 */
function applyThresholdBonusRules(
  runningSubtotal: number,
  rules: DiscountRule[],
): DiscountBonus[] {
  const bonuses: DiscountBonus[] = [];
  for (const r of rules) {
    if (r.kind !== "threshold_bonus") continue;
    const threshold = num(r.step_amount);
    const bonus = num(r.bonus_n);
    if (
      threshold === null ||
      threshold <= 0 ||
      bonus === null ||
      bonus <= 0 ||
      !r.product_id
    )
      continue;
    if (runningSubtotal < threshold) continue;
    bonuses.push({
      product_id: r.product_id,
      qty: bonus,
      source_discount_id: r.id,
      label: `${r.name} · +${bonus} ширхэг бэлэг`,
    });
  }
  return bonuses;
}

function applyCash(amount: number): { discount: number; next: number } {
  const discount = Math.round(amount * CASH_DISCOUNT_PCT);
  return { discount, next: amount - discount };
}

/**
 * Compute the full discount breakdown.
 *
 * Order: product → cash. Each step runs against the running total of
 * the previous step. Cash always runs last because it represents the
 * final tender, not a catalog price. Threshold-bonus rules are
 * evaluated AFTER per-product but BEFORE cash, against the
 * post-product subtotal — that way getting 10% off doesn't accidentally
 * bump you below a threshold you'd otherwise hit.
 *
 * Actually we evaluate threshold against the gross — that's what the
 * buyer expects ("I spent 100K so I get the bonus"). Let me keep it
 * simple: threshold is checked against `running` AFTER product
 * discounts, so the displayed "Нийт төлөх" is the qualifying number.
 */
export function computeDiscount(
  lines: CartLine[],
  paymentMethod: PaymentMethod,
  rules: DiscountRule[] = [],
): DiscountBreakdown {
  const g = gross(lines);
  let running = g;
  const steps: DiscountStep[] = [];

  // 1. Product / category rules
  const product = applyProductRules(lines, rules);
  steps.push(...product.steps);
  running -= product.reduced;
  if (running < 0) running = 0;

  // 2. Threshold-bonus rules (display only)
  const bonuses = applyThresholdBonusRules(running, rules);

  // 3. Cash (always last)
  if (paymentMethod === "cash" && running > 0) {
    const r = applyCash(running);
    steps.push({
      kind: "cash",
      label: `Бэлэн төлбөр ${Math.round(CASH_DISCOUNT_PCT * 100)}%`,
      amount: r.discount,
    });
    running = r.next;
  }

  return {
    gross: g,
    totalDiscount: g - running,
    net: running,
    steps,
    bonuses,
  };
}

/**
 * For a single product, find the best per-product discount that
 * applies and return the effective price. Used by the catalog card to
 * render a "was X / now Y" sale badge.
 */
export function priceWithProductDiscount(
  productId: string,
  categoryId: string | null,
  unitPrice: number,
  rules: DiscountRule[],
): { net: number; pct: number; rule: DiscountRule } | null {
  let best: { pct: number; rule: DiscountRule } | null = null;
  for (const r of rules) {
    if (r.kind !== "product") continue;
    const pct = num(r.pct);
    if (pct === null || pct <= 0) continue;
    const pMatch = !r.product_id || r.product_id === productId;
    const cMatch = !r.category_id || r.category_id === categoryId;
    if (!pMatch || !cMatch) continue;
    if (!best || pct > best.pct) best = { pct, rule: r };
  }
  if (!best) return null;
  return {
    net: Math.round(unitPrice * (1 - best.pct / 100)),
    pct: best.pct,
    rule: best.rule,
  };
}
