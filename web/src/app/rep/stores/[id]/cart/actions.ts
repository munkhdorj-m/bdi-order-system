"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { listAdminIds, notifyMany } from "@/lib/notify";
import { formatMnt } from "@/lib/format";
import { writeOrder, type NewOrderItem } from "@/lib/orders/write";

type PlaceOrderInput = {
  supermarketId: string;
  items: { product_id: string; qty: number }[];
  notes: string | null;
  /** One UUID per checkout, reused when the same checkout is re-sent. */
  requestId?: string;
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
  if (!session.profile.active) {
    return { error: "Таны бүртгэл идэвхгүй байна. BDI-тэй холбогдоно уу." };
  }

  const supabase = await createClient();

  // The order is written with the service role (reps can't write orders
  // directly), so the "is this my store?" check happens here, explicitly.
  const { data: store } = await supabase
    .from("supermarkets")
    .select("id, name, assigned_rep_id, active")
    .eq("id", input.supermarketId)
    .maybeSingle();
  if (!store || store.assigned_rep_id !== session.userId) {
    return { error: "Дэлгүүр олдсонгүй эсвэл хандах эрхгүй." };
  }
  if (!store.active) return { error: "Энэ дэлгүүр идэвхгүй байна." };

  const cleaned = input.items
    .filter((i) => i.product_id && Number.isFinite(i.qty) && i.qty >= 1)
    .map((i) => ({ product_id: i.product_id, qty: Math.floor(i.qty) }));
  if (cleaned.length === 0) return { error: "Сагс хоосон байна." };

  // Prices come from the server only — never from the phone.
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
      { name: p.name, price: Number(p.effective_price) },
    ]),
  );

  const missing = cleaned.filter((i) => !priceMap.has(i.product_id));
  if (missing.length > 0) {
    return { error: "Зарим бараа боломжгүй. Сагсаа шинэчилнэ үү." };
  }

  const itemsToInsert: NewOrderItem[] = cleaned.map((i) => {
    const meta = priceMap.get(i.product_id)!;
    return {
      product_id: i.product_id,
      product_name_snapshot: meta.name,
      qty: i.qty,
      unit_price: meta.price,
    };
  });

  const written = await writeOrder(
    {
      supermarket_id: input.supermarketId,
      placed_by: session.userId,
      notes: input.notes?.trim().slice(0, 1000) || null,
    },
    itemsToInsert,
    input.requestId,
  );
  if ("error" in written) return { error: written.error };

  revalidatePath(`/rep/stores/${input.supermarketId}`);
  revalidatePath(`/rep/orders/${written.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  // A re-sent checkout: the office was already told about this order.
  if (written.duplicate) {
    return { orderId: written.orderId, orderNumber: written.orderNumber };
  }

  // Tell the office, like a store's own order does (push + staff Telegram),
  // after the response so the rep isn't kept waiting.
  const total = itemsToInsert.reduce((s, i) => s + i.qty * i.unit_price, 0);
  after(async () => {
    const adminIds = await listAdminIds();
    await notifyMany(
      adminIds,
      {
        kind: "order_new",
        title: `Шинэ захиалга · ${written.orderNumber}`,
        body: `${store.name ?? "Дэлгүүр"} · ${formatMnt(total)} · ${session.profile.full_name ?? "Төлөөлөгч"}`,
        href: `/admin/orders/${written.orderId}`,
        order_id: written.orderId,
      },
      { telegram: true },
    );
  });

  return { orderId: written.orderId, orderNumber: written.orderNumber };
}
