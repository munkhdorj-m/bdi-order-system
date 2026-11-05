"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { listAdminIds, notifyMany } from "@/lib/notify";
import { isUuid, loadOwnPendingOrder } from "@/lib/orders/write";

type Result = { error?: string; ok?: boolean };

/**
 * Who may change an order here: the store user (or rep) who placed it,
 * while it is still pending. Buyers and reps have no write access to
 * orders in the database (docs/fixes/39), so the writes below use the
 * service role and these checks are the gate. Every write also repeats
 * "still pending" in its own filter, so an order the office confirms in
 * the meantime is left alone.
 */
async function gate(orderId: string) {
  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." } as const;
  if (session.profile.role !== "buyer" && session.profile.role !== "rep") {
    return { error: "Зөвхөн худалдан авагч эсвэл төлөөлөгч өөрчилж болно." } as const;
  }
  if (!session.profile.active) {
    return { error: "Таны бүртгэл идэвхгүй байна. BDI-тэй холбогдоно уу." } as const;
  }
  const order = await loadOwnPendingOrder(orderId, session.userId);
  if ("error" in order) return { error: order.error } as const;
  return { session, order, admin: createAdminClient() } as const;
}

/** Is the order still pending right now? (Checked again just before writing.) */
async function stillPending(admin: ReturnType<typeof createAdminClient>, orderId: string): Promise<boolean> {
  const { data } = await admin.from("orders").select("status").eq("id", orderId).maybeSingle();
  return data?.status === "pending";
}

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function updateOrderItemQty(
  orderId: string,
  itemId: string,
  qty: number,
): Promise<Result> {
  const ctx = await gate(orderId);
  if ("error" in ctx) return { error: ctx.error };
  if (!isUuid(itemId)) return { error: "Бараа олдсонгүй." };

  const cleaned = Math.floor(qty);
  if (!Number.isFinite(cleaned) || cleaned < 1) {
    return { error: "Тоо хэмжээ 1-ээс багагүй байх ёстой." };
  }
  if (!(await stillPending(ctx.admin, orderId))) {
    return { error: "Захиалга баталгаажсан тул өөрчлөх боломжгүй." };
  }

  // Only the quantity, only on this order, never a 0₮ gift line.
  const { data, error } = await ctx.admin
    .from("order_items")
    .update({ qty: cleaned })
    .eq("id", itemId)
    .eq("order_id", orderId)
    .gt("unit_price", 0)
    .select("id, qty");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Энэ барааны тоог өөрчлөх боломжгүй." };
  }

  // orders.subtotal follows via the recompute_order_subtotal trigger.
  refresh(orderId);
  return { ok: true };
}

export async function removeOrderItem(
  orderId: string,
  itemId: string,
): Promise<Result> {
  const ctx = await gate(orderId);
  if ("error" in ctx) return { error: ctx.error };
  if (!isUuid(itemId)) return { error: "Бараа олдсонгүй." };

  // Keep at least one paid line — to drop everything, cancel the order.
  const { count } = await ctx.admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .gt("unit_price", 0);
  if ((count ?? 0) <= 1) {
    return {
      error: "Сүүлчийн барааг хасч болохгүй. Захиалгыг бүхэлд нь цуцлана уу.",
    };
  }
  if (!(await stillPending(ctx.admin, orderId))) {
    return { error: "Захиалга баталгаажсан тул өөрчлөх боломжгүй." };
  }

  const { data, error } = await ctx.admin
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId)
    .gt("unit_price", 0)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Энэ барааг хасах боломжгүй." };
  }

  refresh(orderId);
  return { ok: true };
}

/**
 * Cancel (soft): status → cancelled, history kept for the store and the
 * office. The status filter makes it a no-op if the office confirmed the
 * order a moment earlier.
 */
export async function cancelOrder(orderId: string): Promise<Result> {
  const ctx = await gate(orderId);
  if ("error" in ctx) return { error: ctx.error };

  const { data, error } = await ctx.admin
    .from("orders")
    .update({ status: "cancelled", shipment_id: null })
    .eq("id", orderId)
    .eq("placed_by", ctx.session.userId)
    .eq("status", "pending")
    .select("id, order_number");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Захиалга баталгаажсан тул цуцлах боломжгүй. BDI-тэй холбогдоно уу." };
  }

  // Warn the admins — the warehouse may already be picking this order.
  // Same three channels as a new order.
  const orderNumber = data[0]?.order_number ?? ctx.order.order_number;
  after(async () => {
    const adminIds = await listAdminIds();
    await notifyMany(
      adminIds,
      {
        kind: "order_cancelled",
        title: `Захиалга цуцлагдлаа · ${orderNumber}`,
        body: `${ctx.session.profile.full_name ?? "Худалдан авагч"} цуцаллаа.`,
        href: `/admin/orders/${orderId}`,
        order_id: orderId,
      },
      { telegram: true },
    );
  });

  refresh(orderId);
  return { ok: true };
}
