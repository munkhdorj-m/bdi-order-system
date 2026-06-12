"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { computeDiscount, type DiscountRule } from "@/lib/discount";
import { isPaymentMethod, type PaymentMethod } from "@/lib/payment-method";
import { formatMnt } from "@/lib/format";
import { listAdminIds, notifyMany } from "@/lib/notify";

export type PlaceOrderInput = {
  items: { product_id: string; qty: number }[];
  notes: string | null;
  payment_method?: PaymentMethod;
};

export type PlaceOrderResult = {
  orderId?: string;
  orderNumber?: string;
  error?: string;
};

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  if (!input.items || input.items.length === 0) {
    return { error: "Сагс хоосон байна." };
  }

  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };
  if (session.profile.role !== "buyer" || !session.profile.supermarket_id) {
    return { error: "Зөвхөн худалдан авагч захиалга өгөх боломжтой." };
  }
  const supermarketId = session.profile.supermarket_id;

  const cleaned = input.items
    .filter((i) => i.product_id && i.qty > 0)
    .map((i) => ({ product_id: i.product_id, qty: Math.floor(i.qty) }));
  if (cleaned.length === 0) return { error: "Сагс хоосон байна." };

  const supabase = await createClient();

  // Re-fetch current effective prices server-side. Never trust client prices.
  // Also pull category_id per line so per-category discount rules can match.
  const productIds = cleaned.map((i) => i.product_id);
  const [{ data: priced, error: priceErr }, { data: discountRows }] =
    await Promise.all([
      supabase
        .from("supermarket_prices")
        .select("product_id, name, effective_price, category_id, stock")
        .eq("supermarket_id", supermarketId)
        .in("product_id", productIds),
      // Active discount rules visible via RLS (the policy already filters by
      // active + starts_at/ends_at window).
      supabase
        .from("discounts")
        .select(
          "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id",
        ),
    ]);
  if (priceErr) return { error: priceErr.message };

  const priceMap = new Map<
    string,
    { name: string; price: number; category_id: string | null }
  >(
    (priced ?? []).map((p) => [
      p.product_id,
      {
        name: p.name,
        price: p.effective_price,
        category_id: p.category_id,
      },
    ]),
  );

  const rules = (discountRows as unknown as DiscountRule[] | null) ?? [];

  const missing = cleaned.filter((i) => !priceMap.has(i.product_id));
  if (missing.length > 0) {
    return { error: "Зарим бараа боломжгүй болсон байна. Сагсаа шинэчилнэ үү." };
  }

  // Stock gate — the catalog hides sold-out products, but a cart built
  // earlier (localStorage survives days) can still hold one. Name the
  // product so the buyer knows exactly which line to drop.
  const soldOut = (priced ?? []).filter((p) => (p.stock ?? 0) <= 0);
  if (soldOut.length > 0) {
    return {
      error: `"${soldOut[0].name}" дууссан байна. Сагснаасаа хасаад дахин илгээнэ үү.`,
    };
  }

  const { data: orderNumberRow, error: numErr } = await supabase.rpc(
    "generate_order_number",
  );
  if (numErr) return { error: numErr.message };
  const orderNumber = orderNumberRow as unknown as string;

  // Normalize payment method server-side — never trust a client-supplied
  // string. Default to credit so existing callers keep working.
  const paymentMethod: PaymentMethod = isPaymentMethod(input.payment_method)
    ? input.payment_method
    : "credit";

  // Compute the discount breakdown up-front so we can write the
  // discount_total at insert time. The subtotal column is maintained by
  // the recompute trigger on order_items — we only persist the discount
  // audit trail and the chosen payment method here.
  const discount = computeDiscount(
    cleaned.map((i) => ({
      product_id: i.product_id,
      qty: i.qty,
      unit_price: priceMap.get(i.product_id)!.price,
      category_id: priceMap.get(i.product_id)!.category_id,
    })),
    paymentMethod,
    rules,
  );

  const { data: orderRow, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      supermarket_id: supermarketId,
      placed_by: session.userId,
      notes: input.notes,
      status: "pending",
      payment_method: paymentMethod,
      discount_total: discount.totalDiscount,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !orderRow) {
    return { error: orderErr?.message ?? "Захиалга үүсгэхэд алдаа." };
  }

  const itemsToInsert = cleaned.map((i) => {
    const meta = priceMap.get(i.product_id)!;
    return {
      order_id: orderRow.id,
      product_id: i.product_id,
      product_name_snapshot: meta.name,
      qty: i.qty,
      unit_price: meta.price,
    };
  });

  // Bonus items earned via threshold rules — written into order_items
  // at unit_price=0 so they show up in the order's line-item list for
  // the admin/rep fulfilling it. Without this the buyer sees "you got
  // 2 free X" in the cart but the order record has no record of it,
  // and the rep delivers the order without the bonus. The "🎁" prefix
  // on product_name_snapshot makes the freebie obvious at a glance in
  // the admin order detail without needing a schema change.
  //
  // We have to look up the bonus products' names since they aren't
  // necessarily in the buyer's regular cart (so they aren't in priceMap).
  const bonusProductIds = Array.from(
    new Set(discount.bonuses.map((b) => b.product_id)),
  );
  if (bonusProductIds.length > 0) {
    const { data: bonusProducts } = await supabase
      .from("products")
      .select("id, name")
      .in("id", bonusProductIds);
    const bonusNameById = new Map(
      (bonusProducts ?? []).map((p) => [p.id as string, p.name as string]),
    );
    for (const b of discount.bonuses) {
      itemsToInsert.push({
        order_id: orderRow.id,
        product_id: b.product_id,
        product_name_snapshot: `🎁 ${bonusNameById.get(b.product_id) ?? "Бэлэг бараа"}`,
        qty: b.qty,
        unit_price: 0,
      });
    }
  }

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(itemsToInsert);
  if (itemsErr) return { error: itemsErr.message };

  // Look up the store name for the in-app admin notification (best-effort).
  const { data: storeRow } = await supabase
    .from("supermarkets")
    .select("name")
    .eq("id", supermarketId)
    .single();

  const subtotal = itemsToInsert.reduce(
    (sum, i) => sum + i.qty * i.unit_price,
    0,
  );

  // In-app notification fan-out to every active admin. Swallowed inside
  // notifyMany so it can never break the order flow.
  after(async () => {
    const adminIds = await listAdminIds();
    await notifyMany(adminIds, {
      kind: "order_new",
      title: `Шинэ захиалга · ${orderRow.order_number}`,
      body: `${storeRow?.name ?? "Дэлгүүр"} · ${formatMnt(subtotal)}`,
      href: `/admin/orders/${orderRow.id}`,
      order_id: orderRow.id,
    });
  });

  revalidatePath("/orders");
  return { orderId: orderRow.id, orderNumber: orderRow.order_number };
}
