"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NEXT_STATUS, type OrderStatus } from "@/lib/order-status";

type Result = { error?: string };

export async function advanceOrderStatus(
  id: string,
  currentStatus: OrderStatus,
): Promise<Result> {
  const next = NEXT_STATUS[currentStatus];
  if (!next) return { error: "Энэ захиалгыг урагшлуулах боломжгүй." };
  return setOrderStatus(id, next);
}

export async function cancelOrder(id: string): Promise<Result> {
  return setOrderStatus(id, "cancelled");
}

export async function reopenOrder(id: string): Promise<Result> {
  return setOrderStatus(id, "pending");
}

async function setOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Result> {
  const supabase = await createClient();

  const update: Record<string, unknown> = { status };
  const now = new Date().toISOString();
  if (status === "confirmed") update.confirmed_at = now;
  if (status === "delivered") update.delivered_at = now;

  const { error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  return {};
}
