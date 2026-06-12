"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

type PlaceOrderInput = {
  supermarketId: string;
  items: { product_id: string; qty: number }[];
  notes: string | null;
};

type PlaceOrderResult = {
  orderId?: string;
  orderNumber?: string;
  error?: string;
};

export async function placeOrderForStore(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  if (!input.supermarketId) return { error: "Дэлгүүр сонгогдоогүй." };
  if (!input.items || input.items.length === 0) {
    return { error: "Сагс хоосон байна." };
  }

  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };
  if (session.profile.role !== "rep") {
    return { error: "Зөвхөн төлөөлөгч энэ үйлдлийг хийх боломжтой." };
  }

  const supabase = await createClient();

  // RLS already enforces: rep can only insert orders for stores where
  // assigned_rep_id = auth.uid(). Defense-in-depth check for nicer UX.
  const { data: store } = await supabase
    .from("supermarkets")
    .select("id")
    .eq("id", input.supermarketId)
    .single();
  if (!store) {
    return { error: "Дэлгүүр олдсонгүй эсвэл хандах эрхгүй." };
  }

  const cleaned = input.items
    .filter((i) => i.product_id && i.qty > 0)
    .map((i) => ({ product_id: i.product_id, qty: Math.floor(i.qty) }));
  if (cleaned.length === 0) return { error: "Сагс хоосон байна." };

  const productIds = cleaned.map((i) => i.product_id);
  const { data: priced, error: priceErr } = await supabase
    .from("supermarket_prices")
    .select("product_id, name, effective_price")
    .eq("supermarket_id", input.supermarketId)
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
    return { error: "Зарим бараа боломжгүй. Сагсаа шинэчилнэ үү." };
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
      supermarket_id: input.supermarketId,
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

  revalidatePath(`/rep/stores/${input.supermarketId}`);
  revalidatePath(`/rep/orders/${orderRow.id}`);
  return { orderId: orderRow.id, orderNumber: orderRow.order_number };
}
