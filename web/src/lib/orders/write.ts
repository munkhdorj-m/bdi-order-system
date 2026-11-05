import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one place a store's or a rep's order gets written.
 *
 * Buyers and reps have NO write access to orders / order_items in the
 * database (docs/fixes/39-orders-server-only-writes.sql) — otherwise
 * anyone signed in could call the API directly and save their own prices,
 * discount or status. So these writes use the service role, and every
 * caller must first check, in code, who is asking and what they may touch,
 * and must price every line on the server.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export type NewOrder = {
  supermarket_id: string;
  placed_by: string;
  notes: string | null;
  payment_method?: string;
  discount_total?: number;
};

export type NewOrderItem = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
  unit_price: number;
};

export type WriteOrderResult =
  | { orderId: string; orderNumber: string; duplicate: boolean }
  | { error: string };

/**
 * Insert a pending order and its lines. `requestId` — a UUID the phone
 * makes once per checkout — becomes the order's id, so when a dropped
 * connection makes the phone send the same checkout again, we hand back
 * the order already made (`duplicate: true`) instead of creating another.
 */
export async function writeOrder(
  order: NewOrder,
  items: NewOrderItem[],
  requestId?: string | null,
): Promise<WriteOrderResult> {
  if (items.length === 0) return { error: "Сагс хоосон байна." };
  const admin = createAdminClient();
  const id = isUuid(requestId) ? requestId.toLowerCase() : undefined;

  if (id) {
    const existing = await findOwnOrder(admin, id, order.placed_by);
    if (existing) return existing;
  }

  const { data: number, error: numErr } = await admin.rpc("generate_order_number");
  if (numErr || !number) {
    return { error: numErr?.message ?? "Захиалгын дугаар үүсгэж чадсангүй." };
  }

  const { data: row, error: orderErr } = await admin
    .from("orders")
    .insert({ ...order, ...(id ? { id } : {}), order_number: number as string, status: "pending" })
    .select("id, order_number")
    .single();
  if (orderErr || !row) {
    // The same checkout arrived twice at once and the other one won.
    if (id && orderErr?.code === "23505") {
      const existing = await findOwnOrder(admin, id, order.placed_by);
      if (existing) return existing;
    }
    return { error: orderErr?.message ?? "Захиалга үүсгэхэд алдаа гарлаа." };
  }

  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(items.map((i) => ({ ...i, order_id: row.id })));
  if (itemsErr) {
    // No empty order left behind; a retry then starts clean.
    await admin.from("orders").delete().eq("id", row.id);
    return { error: itemsErr.message };
  }

  // orders.subtotal is filled in by the recompute_order_subtotal trigger.
  return { orderId: row.id as string, orderNumber: row.order_number as string, duplicate: false };
}

async function findOwnOrder(
  admin: SupabaseClient,
  id: string,
  userId: string,
): Promise<WriteOrderResult | null> {
  const { data } = await admin
    .from("orders")
    .select("id, order_number, placed_by")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  // Someone else's id: say nothing about it.
  if (data.placed_by !== userId) return { error: "Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу." };
  return { orderId: data.id as string, orderNumber: data.order_number as string, duplicate: true };
}

/** A pending order the caller placed, or why they can't change it. */
export async function loadOwnPendingOrder(
  orderId: string,
  userId: string,
): Promise<{ id: string; order_number: string } | { error: string }> {
  if (!isUuid(orderId)) return { error: "Захиалга олдсонгүй." };
  const { data: order } = await createAdminClient()
    .from("orders")
    .select("id, order_number, status, placed_by")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.placed_by !== userId) return { error: "Захиалга олдсонгүй." };
  if (order.status !== "pending") {
    return { error: "Зөвхөн «Хүлээгдэж буй» захиалгыг өөрчилж болно." };
  }
  return { id: order.id as string, order_number: order.order_number as string };
}
