"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { sendNewOrderEmail } from "@/lib/notifications";

export type PlaceOrderInput = {
  items: { product_id: string; qty: number }[];
  notes: string | null;
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
  const productIds = cleaned.map((i) => i.product_id);
  const { data: priced, error: priceErr } = await supabase
    .from("supermarket_prices")
    .select("product_id, name, effective_price")
    .eq("supermarket_id", supermarketId)
    .in("product_id", productIds);
  if (priceErr) return { error: priceErr.message };

  const priceMap = new Map<string, { name: string; price: number }>(
    (priced ?? []).map((p) => [
      p.product_id,
      { name: p.name, price: p.effective_price },
    ]),
  );

  const missing = cleaned.filter((i) => !priceMap.has(i.product_id));
  if (missing.length > 0) {
    return { error: "Зарим бараа боломжгүй болсон байна. Сагсаа шинэчилнэ үү." };
  }

  const { data: orderNumberRow, error: numErr } = await supabase.rpc(
    "generate_order_number",
  );
  if (numErr) return { error: numErr.message };
  const orderNumber = orderNumberRow as unknown as string;

  const { data: orderRow, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      supermarket_id: supermarketId,
      placed_by: session.userId,
      notes: input.notes,
      status: "pending",
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

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(itemsToInsert);
  if (itemsErr) return { error: itemsErr.message };

  // Look up the store name for the email body (best-effort).
  const { data: storeRow } = await supabase
    .from("supermarkets")
    .select("name")
    .eq("id", supermarketId)
    .single();

  const subtotal = itemsToInsert.reduce(
    (sum, i) => sum + i.qty * i.unit_price,
    0,
  );

  // Fire-and-forget email after response is sent. Errors are swallowed
  // inside sendNewOrderEmail so they can never break the order flow.
  after(() =>
    sendNewOrderEmail({
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      storeName: storeRow?.name ?? "",
      buyerName: session.profile.full_name,
      buyerEmail: session.email,
      placedByRole: "buyer",
      notes: input.notes,
      subtotal,
      items: itemsToInsert.map((i) => ({
        product_name_snapshot: i.product_name_snapshot,
        qty: i.qty,
        unit_price: i.unit_price,
        line_total: i.qty * i.unit_price,
      })),
    }),
  );

  revalidatePath("/orders");
  return { orderId: orderRow.id, orderNumber: orderRow.order_number };
}
