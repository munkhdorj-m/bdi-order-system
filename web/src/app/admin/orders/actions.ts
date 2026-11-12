"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError, getSession } from "@/lib/auth";
import { NEXT_STATUS, type OrderStatus } from "@/lib/order-status";
import { LIVE_STATUSES } from "@/lib/ebarimt";
import { notifyOrderCorrected, notifyOrderStatus } from "@/lib/orders/status-notify";
import { correctOrder } from "@/lib/orders/correct";
import type { LineChange } from "@/lib/orders/correction";

type Result = { error?: string };

/**
 * Correct an order's lines after it was placed — other quantities at
 * delivery, a product taken off or added (Mercury's "ordered vs
 * delivered"). Any status but cancelled; an order whose e-Barimt is sent
 * or waiting must have the receipt returned first. The store is told.
 */
export async function correctOrderLines(input: {
  orderId: string;
  changes: LineChange[];
  reason: string | null;
  expectedUpdatedAt: string | null;
}): Promise<Result & { changed?: boolean }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const session = await getSession();
  if (!session) return { error: "Нэвтэрнэ үү." };

  const r = await correctOrder({
    orderId: input.orderId,
    changes: input.changes,
    reason: input.reason,
    actorId: session.userId,
    allowedStatuses: ["pending", "confirmed", "shipped", "delivered"],
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if ("error" in r) return { error: r.error };
  if (r.changed) {
    after(() => notifyOrderCorrected(input.orderId, r.totalBefore, r.totalAfter));
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    revalidatePath("/admin/dispatch");
    revalidatePath("/admin/shipments");
    revalidatePath("/admin/ebarimt");
    revalidatePath("/admin");
    revalidatePath(`/orders/${input.orderId}`);
    revalidatePath(`/rep/orders/${input.orderId}`);
  }
  return { changed: r.changed };
}

/**
 * One step forward. Confirmed orders don't go to "shipped" here: they ship
 * by being put on a delivery run (/admin/dispatch), so they're on the
 * delivery note and the loading list.
 */
export async function advanceOrderStatus(
  id: string,
  currentStatus: OrderStatus,
): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const next = NEXT_STATUS[currentStatus];
  if (!next) return { error: "Энэ захиалгыг урагшлуулах боломжгүй." };
  if (currentStatus === "confirmed") {
    return { error: "Баталгаажсан захиалгыг «Хүргэлт хуваарлах» хуудсаар ачилтад оноож гаргана." };
  }
  return setOrderStatus(id, next, [currentStatus]);
}

export async function cancelOrder(id: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  // A sent (or queued) e-Barimt must be returned first, or the tax record
  // would point at an order that no longer exists in any list.
  if (await hasLiveReceipt(id)) {
    return { error: "Энэ захиалгад е-баримт илгээгдсэн байна. Эхлээд Е-баримт хуудсаас буцаана уу." };
  }
  // An order on a run that already left (closed) stays linked to it, so
  // the run's history shows what went on the truck. Documents and totals
  // skip cancelled orders anyway.
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("orders")
    .select("shipment:shipment_id(status)")
    .eq("id", id)
    .maybeSingle();
  const onClosedRun =
    (current as unknown as { shipment: { status: string } | null } | null)?.shipment?.status === "closed";
  return setOrderStatus(id, "cancelled", ["pending", "confirmed", "shipped"], { keepShipment: onClosedRun });
}

export async function reopenOrder(id: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  return setOrderStatus(id, "pending", ["cancelled"]);
}

/**
 * Permanently remove a cancelled order (its lines and notifications go with
 * it). Only cancelled orders, and never one with an e-Barimt receipt —
 * the tax record must stay.
 */
export async function deleteCancelledOrder(id: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const supabase = await createClient();
  const { count: receipts } = await supabase
    .from("ebarimt_receipts")
    .select("id", { count: "exact", head: true })
    .eq("order_id", id);
  if ((receipts ?? 0) > 0) {
    return { error: "Энэ захиалгад е-баримт гарсан тул устгах боломжгүй." };
  }
  const { data, error } = await supabase
    .from("orders")
    .delete()
    .eq("id", id)
    .eq("status", "cancelled")
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Зөвхөн цуцлагдсан захиалгыг устгана." };

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return {};
}

async function hasLiveReceipt(orderId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("ebarimt_receipts")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("status", LIVE_STATUSES);
  return (count ?? 0) > 0;
}

// Internal — every public entry point above has already checked admin
// guard. `from` = the statuses this change is valid from, so a stale click
// (the list was open while someone else moved the order) can't undo it.
async function setOrderStatus(
  id: string,
  status: OrderStatus,
  from: OrderStatus[],
  opts: { keepShipment?: boolean } = {},
): Promise<Result> {
  const supabase = await createClient();

  const update: Record<string, unknown> = { status };
  const now = new Date().toISOString();
  if (status === "confirmed") update.confirmed_at = now;
  if (status === "shipped") update.shipped_at = now;
  if (status === "delivered") update.delivered_at = now;
  // Cancelled or reopened orders leave an OPEN delivery run: they aren't
  // going out with it, and the run can then be edited or deleted. (A
  // closed run keeps them — see cancelOrder.)
  if ((status === "cancelled" && !opts.keepShipment) || status === "pending") update.shipment_id = null;

  const { data: row, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .in("status", from)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: "Захиалгын төлөв өөрчлөгдсөн байна. Хуудсаа сэргээнэ үү." };

  // The store's accounts (and the rep who entered it) hear about it in the
  // background; staff don't need a push about orders they handle.
  after(() => notifyOrderStatus([row.id as string], status));

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/ebarimt");
  revalidatePath("/admin");
  return {};
}
