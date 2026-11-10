"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import {
  computeDiscount,
  rulesForPriceList,
  type DiscountRule,
} from "@/lib/discount";
import { isBuyerPaymentMethod, type PaymentMethod } from "@/lib/payment-method";
import { formatMnt } from "@/lib/format";
import { listAdminIds, notifyMany } from "@/lib/notify";
import { duplicateInfo, writeOrder, type DuplicateOrder, type NewOrderItem } from "@/lib/orders/write";

export type PlaceOrderInput = {
  items: { product_id: string; qty: number }[];
  notes: string | null;
  payment_method?: PaymentMethod;
  /** One UUID per checkout, reused when the same checkout is re-sent. */
  requestId?: string;
};

/** A cart line that can't be ordered, so the cart can mark or drop it. */
export type CartProblem = {
  product_id: string;
  /** unavailable = no longer sold to this store; sold_out = stock is 0. */
  reason: "unavailable" | "sold_out";
  name?: string;
};

export type PlaceOrderResult = {
  orderId?: string;
  orderNumber?: string;
  error?: string;
  /** Every line that blocked the order (not just the first). */
  problems?: CartProblem[];
  /** Set when this checkout id already had an order: nothing new was written. */
  duplicate?: DuplicateOrder;
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
  if (!session.profile.active) {
    return { error: "Таны бүртгэл идэвхгүй байна. BDI-тэй холбогдоно уу." };
  }
  const supermarketId = session.profile.supermarket_id;

  const cleaned = input.items
    .filter((i) => i.product_id && Number.isFinite(i.qty) && i.qty >= 1)
    .map((i) => ({ product_id: i.product_id, qty: Math.floor(i.qty) }));
  if (cleaned.length === 0) return { error: "Сагс хоосон байна." };

  const supabase = await createClient();

  // Re-fetch current effective prices server-side. Never trust client prices.
  // Also pull category_id per line so per-category discount rules can match.
  const productIds = cleaned.map((i) => i.product_id);
  const [
    { data: priced, error: priceErr },
    { data: discountRows },
    { data: storePlRow },
  ] = await Promise.all([
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
        "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, target_mode, target_price_list_ids",
      ),
    // Store targeting (fix 30) — needed to drop rules that don't apply
    // to this store's price list before the discount math runs.
    supabase
      .from("supermarkets")
      .select("price_list_id")
      .eq("id", supermarketId)
      .single(),
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

  const rules = rulesForPriceList(
    (discountRows as unknown as DiscountRule[] | null) ?? [],
    (storePlRow?.price_list_id as string | null) ?? null,
  );

  // Lines that can't be ordered: products no longer sold to this store,
  // and — the stock gate — sold-out ones (a cart can sit on a phone for
  // days). ALL of them are returned so the cart can mark every line at
  // once instead of one failed send per product.
  const problems: CartProblem[] = [
    ...cleaned
      .filter((i) => !priceMap.has(i.product_id))
      .map((i) => ({ product_id: i.product_id, reason: "unavailable" as const })),
    ...(priced ?? [])
      .filter((p) => (Number(p.stock) || 0) <= 0)
      .map((p) => ({ product_id: p.product_id as string, reason: "sold_out" as const, name: p.name as string })),
  ];
  if (problems.length > 0) {
    const only = problems.length === 1 ? problems[0] : null;
    return {
      problems,
      error: only?.name
        ? `«${only.name}» дууссан байна. Сагснаасаа хасаад дахин илгээнэ үү.`
        : `${problems.length} бараа одоо захиалах боломжгүй байна. Сагсанд тэмдэглэлээ — хасаад дахин илгээнэ үү.`,
    };
  }

  // Normalize payment method server-side — never trust a client-supplied
  // string. Default to credit so existing callers keep working.
  const paymentMethod: PaymentMethod = isBuyerPaymentMethod(input.payment_method)
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

  const itemsToInsert: NewOrderItem[] = cleaned.map((i) => {
    const meta = priceMap.get(i.product_id)!;
    return {
      product_id: i.product_id,
      product_name_snapshot: meta.name,
      qty: i.qty,
      unit_price: Number(meta.price),
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
        product_id: b.product_id,
        product_name_snapshot: `🎁 ${bonusNameById.get(b.product_id) ?? "Бэлэг бараа"}`,
        qty: b.qty,
        unit_price: 0,
      });
    }
  }

  // Written by the server only — prices, discount and status all come
  // from here, never from the phone (see lib/orders/write.ts).
  const written = await writeOrder(
    {
      supermarket_id: supermarketId,
      placed_by: session.userId,
      notes: input.notes?.trim().slice(0, 1000) || null,
      payment_method: paymentMethod,
      discount_total: discount.totalDiscount,
    },
    itemsToInsert,
    input.requestId,
  );
  if ("error" in written) return { error: written.error };
  const orderRow = { id: written.orderId, order_number: written.orderNumber };
  // A re-sent checkout: the office was already told about this order.
  revalidatePath("/orders");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  if (written.duplicate) {
    return { orderId: orderRow.id, orderNumber: orderRow.order_number, duplicate: duplicateInfo(written) };
  }

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

  // Notification fan-out to every active admin: in-app feed + device
  // push + the shared staff Telegram chat. Runs in after() so none of
  // it adds latency to the buyer's checkout, and every channel is
  // swallowed inside notifyMany so it can never break the order flow.
  after(async () => {
    const adminIds = await listAdminIds();
    await notifyMany(
      adminIds,
      {
        kind: "order_new",
        title: `Шинэ захиалга · ${orderRow.order_number}`,
        body: `${storeRow?.name ?? "Дэлгүүр"} · ${formatMnt(subtotal)}`,
        href: `/admin/orders/${orderRow.id}`,
        order_id: orderRow.id,
      },
      { telegram: true },
    );
  });

  return { orderId: orderRow.id, orderNumber: orderRow.order_number };
}
