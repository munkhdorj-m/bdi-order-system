"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, hasActiveRole } from "@/lib/auth";
import { loadDeliveryOrder } from "@/lib/delivery-runs";
import { correctOrder } from "@/lib/orders/correct";
import type { LineChange } from "@/lib/orders/correction";
import { notifyOrderCorrected, notifyOrderStatus } from "@/lib/orders/status-notify";
import { listAdminIds, notifyMany } from "@/lib/notify";
import { LIVE_STATUSES } from "@/lib/ebarimt";
import { formatDayMonth } from "@/lib/datetime";

/**
 * What the delivery person does at a store's door, from the phone:
 *
 *   completeDelivery   hand the order over — with the quantities actually
 *                      delivered, if they differ — and mark it delivered
 *   couldNotDeliver    shop closed / refused: the order goes back to the
 *                      office's unplanned list with the reason
 *
 * Both act only on an order of a run that has left ("Ачилт хаасан") and
 * whose Түгээгч is the signed-in user; loadDeliveryOrder checks that.
 * Writes use the service role — a rep has no write access to orders.
 */

type Result = { error?: string };

async function gate(orderId: string) {
  const session = await getSession();
  if (!session) return { error: "Нэвтэрнэ үү." } as const;
  if (!hasActiveRole(session.profile, "rep")) return { error: "Зөвхөн түгээгч хийх боломжтой." } as const;
  const loaded = await loadDeliveryOrder(orderId, session.userId);
  if ("error" in loaded) return { error: loaded.error } as const;
  const order = loaded.order;
  if (order.shipment.status !== "closed") {
    return { error: "Ачилт хараахан гараагүй байна (оффис хаагаагүй)." } as const;
  }
  if (order.status === "delivered") return { error: "Энэ захиалга аль хэдийн хүргэгдсэн." } as const;
  if (order.status !== "shipped") return { error: "Энэ захиалга хүргэлтэнд гараагүй байна." } as const;
  return { session, order } as const;
}

function refresh(orderId: string) {
  revalidatePath("/rep/delivery");
  revalidatePath(`/rep/delivery/${orderId}`);
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/ebarimt");
  revalidatePath("/admin");
  revalidatePath(`/orders/${orderId}`);
}

export async function completeDelivery(input: {
  orderId: string;
  /** Quantities that differ from the order (0 = not delivered at all). Empty = delivered as ordered. */
  changes: LineChange[];
  expectedUpdatedAt: string;
}): Promise<Result> {
  const ctx = await gate(input.orderId);
  if ("error" in ctx) return { error: ctx.error };
  const orderId = ctx.order.id;

  if (Array.isArray(input.changes) && input.changes.length > 0) {
    const corrected = await correctOrder({
      orderId,
      changes: input.changes,
      reason: "Хүргэлтээр өөрчилсөн",
      actorId: ctx.session.userId,
      allowedStatuses: ["shipped"],
      expectedUpdatedAt: input.expectedUpdatedAt,
      mayAddProducts: false,
    });
    if ("error" in corrected) return { error: corrected.error };
    if (corrected.changed) {
      after(() => notifyOrderCorrected(orderId, corrected.totalBefore, corrected.totalAfter));
    }
  }

  const { data, error } = await createAdminClient()
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "shipped")
    .select("id");
  refresh(orderId);
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа сэргээнэ үү." };
  after(() => notifyOrderStatus([orderId], "delivered"));
  return {};
}

export async function couldNotDeliver(input: { orderId: string; reason: string }): Promise<Result> {
  const ctx = await gate(input.orderId);
  if ("error" in ctx) return { error: ctx.error };
  const { order, session } = ctx;
  const reason = (input.reason ?? "").trim().slice(0, 200);
  if (!reason) return { error: "Шалтгаанаа сонгоно уу." };

  const admin = createAdminClient();
  const { count } = await admin
    .from("ebarimt_receipts")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id)
    .in("status", LIVE_STATUSES);
  if ((count ?? 0) > 0) {
    return { error: "Энэ захиалгад е-баримт илгээгдсэн байна. Оффистой холбогдоно уу." };
  }

  // The reason travels with the order: the office sees it on the dispatch board.
  const stamp = `[Хүргэж чадаагүй ${formatDayMonth(new Date().toISOString())}: ${reason}]`;
  const notes = [order.notes?.trim(), stamp].filter(Boolean).join(" ").slice(0, 1000);
  const { data, error } = await admin
    .from("orders")
    // The planned day stays, so the office sees it up front as overdue rather than among old orders.
    .update({ status: "confirmed", shipped_at: null, shipment_id: null, notes })
    .eq("id", order.id)
    .eq("status", "shipped")
    .select("id");
  refresh(order.id);
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа сэргээнэ үү." };

  after(async () => {
    const adminIds = await listAdminIds();
    await notifyMany(
      adminIds,
      {
        kind: "order_status",
        title: `${order.order_number} · Хүргэж чадсангүй`,
        body: `${order.store.name}: ${reason} (${session.profile.full_name ?? "түгээгч"})`,
        href: "/admin/dispatch",
        order_id: order.id,
      },
      { telegram: true },
    );
  });
  return {};
}
