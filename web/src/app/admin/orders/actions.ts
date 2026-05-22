"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  NEXT_STATUS,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { notify } from "@/lib/notify";

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
  if (status === "shipped") update.shipped_at = now;
  if (status === "delivered") update.delivered_at = now;

  // Pull placed_by + order_number so the notification can target the
  // buyer and link back to their order detail.
  const { data: row, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("id, order_number, placed_by")
    .single();
  if (error) return { error: error.message };

  if (row?.placed_by) {
    await notify({
      user_id: row.placed_by,
      kind: "order_status",
      title: `${row.order_number} · ${STATUS_LABELS[status]}`,
      body:
        status === "cancelled"
          ? "Захиалга цуцлагдсан."
          : status === "delivered"
            ? "Захиалга хүргэгдсэн."
            : `Шинэ төлөв: ${STATUS_LABELS[status]}`,
      href: `/orders/${row.id}`,
      order_id: row.id,
    });
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  return {};
}
