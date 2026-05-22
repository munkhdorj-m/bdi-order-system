"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

type Result = { error?: string; ok?: boolean };

type LoadOk = {
  supabase: SupabaseClient;
  order: { id: string; status: string; placed_by: string | null };
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
};
type LoadErr = { error: string };

/**
 * Centralized authorization gate for buyer-initiated order mutations.
 *
 * Returns the regular (cookie-bound) Supabase client — never the
 * service-role admin client. RLS policies in
 * `docs/fixes/12-buyer-order-modifications.sql` permit:
 *   - orders UPDATE when buyer + placed_by + status='pending'
 *     and the new status stays 'pending' or flips to 'cancelled'
 *   - order_items UPDATE + DELETE where the parent order matches the above
 * so every write below is RLS-enforced regardless of these app-level checks.
 *
 * The app-level guards stay as defense-in-depth + nicer error messages.
 */
async function loadOrderForBuyer(orderId: string): Promise<LoadOk | LoadErr> {
  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };
  if (session.profile.role !== "buyer" && session.profile.role !== "rep") {
    return {
      error: "Зөвхөн худалдан авагч эсвэл төлөөлөгч өөрчилж болно.",
    };
  }
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, placed_by")
    .eq("id", orderId)
    .single();
  if (error || !order) return { error: "Захиалга олдсонгүй." };
  if (order.status !== "pending") {
    return {
      error: "Зөвхөн 'Хүлээгдэж буй' захиалгыг өөрчилж болно.",
    };
  }
  if (order.placed_by !== session.userId) {
    return { error: "Зөвхөн өөрийн захиалгыг өөрчилж болно." };
  }
  return { supabase, order, session };
}

export async function updateOrderItemQty(
  orderId: string,
  itemId: string,
  qty: number,
): Promise<Result> {
  const ctx = await loadOrderForBuyer(orderId);
  if ("error" in ctx) return { error: ctx.error };

  const cleaned = Math.floor(qty);
  if (!Number.isFinite(cleaned) || cleaned < 1) {
    return { error: "Тоо хэмжээ 1-ээс багагүй байх ёстой." };
  }

  const { data, error } = await ctx.supabase
    .from("order_items")
    .update({ qty: cleaned })
    .eq("id", itemId)
    .eq("order_id", orderId)
    .select("id, qty");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Барааны тоог өөрчилж чадсангүй." };
  }

  // Order subtotal is recomputed by the `recompute_order_subtotal` trigger
  // (see docs/schema.sql) — we just need to bust the route cache.
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function removeOrderItem(
  orderId: string,
  itemId: string,
): Promise<Result> {
  const ctx = await loadOrderForBuyer(orderId);
  if ("error" in ctx) return { error: ctx.error };

  // Server-side mirror of the client's "can't remove last item" rule — UI
  // already blocks this, but a hand-crafted request shouldn't slip past.
  const { count } = await ctx.supabase
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("order_id", orderId);
  if ((count ?? 0) <= 1) {
    return {
      error: "Сүүлчийн барааг хасч болохгүй. Захиалгыг бүхэлд нь цуцлана уу.",
    };
  }

  const { data, error } = await ctx.supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Барааг хасч чадсангүй." };
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

/**
 * Soft-cancel the order by flipping status to 'cancelled'. Matches the
 * intent stated in the buyer-modifications migration and preserves the
 * order history for the buyer + admin.
 *
 * `.select()` (no `.single()`) so a silent RLS rejection returns an empty
 * array instead of PGRST116 "Cannot coerce the result to a single JSON
 * object" — we want to localize that case ourselves.
 */
export async function cancelOrder(orderId: string): Promise<Result> {
  const ctx = await loadOrderForBuyer(orderId);
  if ("error" in ctx) return { error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .select("id, status");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    // RLS silently rejected — most often because the buyer-modifications
    // migration only grants UPDATE to role='buyer'. A rep trying to cancel
    // hits this path. Surface a useful hint.
    return {
      error: `Захиалгыг цуцлах эрхгүй байна (role=${ctx.session.profile.role}).`,
    };
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}
