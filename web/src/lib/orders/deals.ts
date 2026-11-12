import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDiscount, rulesForPriceList, type DiscountRule } from "@/lib/discount";
import { isBuyerPaymentMethod, type PaymentMethod } from "@/lib/payment-method";

const RULE_COLUMNS =
  "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, starts_at, ends_at, active, target_mode, target_price_list_ids";

type RuleRow = DiscountRule & { starts_at: string | null; ends_at: string | null; active: boolean };

/** Was the deal running when the order was placed? */
function ranAt(rule: RuleRow, at: number): boolean {
  if (!rule.active) return false;
  if (rule.starts_at && Date.parse(rule.starts_at) > at) return false;
  if (rule.ends_at && Date.parse(rule.ends_at) < at) return false;
  return true;
}

/**
 * The deals that applied to a store's order placed at `placedAt` — the
 * ones running then, for the price list the store is on. Fixing a quantity
 * after a sale ends mustn't cost the store its sale.
 */
export async function rulesAtOrderTime(
  admin: ReturnType<typeof createAdminClient>,
  storeId: string,
  placedAt: string,
): Promise<DiscountRule[]> {
  const [{ data: store }, { data: ruleRows }] = await Promise.all([
    admin.from("supermarkets").select("price_list_id").eq("id", storeId).maybeSingle(),
    admin.from("discounts").select(RULE_COLUMNS),
  ]);
  const at = Date.parse(placedAt);
  return rulesForPriceList(
    ((ruleRows ?? []) as unknown as RuleRow[]).filter((r) => ranAt(r, at)),
    (store?.price_list_id as string | null) ?? null,
  );
}

/**
 * Re-work a pending order's deals after its lines changed: the discount
 * (orders.discount_total) and the free-gift lines (0₮ rows) are computed
 * again from the paid lines, exactly as checkout does.
 *
 * Uses the deals that were running when the order was PLACED — fixing a
 * quantity after a sale ends mustn't cost the store its sale. Only for
 * orders a store placed itself; rep- and office-entered orders are priced
 * without deals and are left as they are.
 */
export async function recomputeOrderDeals(orderId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, supermarket_id, payment_method, created_at, placer:placed_by(role)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "pending") return {};
  const placer = order.placer as unknown as { role: string } | null;
  if (placer?.role !== "buyer") return {};

  const [{ data: lines }, rules] = await Promise.all([
    admin
      .from("order_items")
      .select("id, product_id, qty, unit_price, products(category_id)")
      .eq("order_id", orderId),
    rulesAtOrderTime(admin, order.supermarket_id as string, order.created_at as string),
  ]);

  const paid = (lines ?? []).filter((l) => Number(l.unit_price) > 0);
  const gifts = (lines ?? []).filter((l) => Number(l.unit_price) === 0);
  const payment: PaymentMethod = isBuyerPaymentMethod(order.payment_method) ? order.payment_method : "credit";

  const deal = computeDiscount(
    paid.map((l) => ({
      product_id: l.product_id as string,
      qty: Number(l.qty),
      unit_price: Number(l.unit_price),
      category_id: (l.products as unknown as { category_id: string | null } | null)?.category_id ?? null,
    })),
    payment,
    rules,
  );

  // Gifts: rewrite only when they actually changed.
  const want = new Map<string, number>();
  for (const b of deal.bonuses) want.set(b.product_id, (want.get(b.product_id) ?? 0) + b.qty);
  const have = new Map<string, number>();
  for (const g of gifts) have.set(g.product_id as string, (have.get(g.product_id as string) ?? 0) + Number(g.qty));
  const giftsChanged =
    want.size !== have.size || [...want].some(([id, qty]) => have.get(id) !== qty);

  if (giftsChanged) {
    if (gifts.length > 0) {
      const { error } = await admin
        .from("order_items")
        .delete()
        .eq("order_id", orderId)
        .eq("unit_price", 0);
      if (error) return { error: error.message };
    }
    if (want.size > 0) {
      const { data: names } = await admin.from("products").select("id, name").in("id", [...want.keys()]);
      const nameOf = new Map((names ?? []).map((p) => [p.id as string, p.name as string]));
      const { error } = await admin.from("order_items").insert(
        [...want].map(([product_id, qty]) => ({
          order_id: orderId,
          product_id,
          product_name_snapshot: `🎁 ${nameOf.get(product_id) ?? "Бэлэг бараа"}`,
          qty,
          unit_price: 0,
        })),
      );
      if (error) return { error: error.message };
    }
  }

  const { error } = await admin
    .from("orders")
    .update({ discount_total: deal.totalDiscount })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  return {};
}
