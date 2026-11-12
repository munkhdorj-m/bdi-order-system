import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { formatMnt } from "@/lib/format";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

const BODY: Partial<Record<OrderStatus, string>> = {
  confirmed: "Захиалга баталгаажлаа.",
  shipped: "Захиалга хүргэлтэнд гарлаа.",
  delivered: "Захиалга хүргэгдлээ.",
  cancelled: "Захиалга цуцлагдлаа.",
  pending: "Захиалга дахин нээгдлээ.",
};

type Message = { title: string; body: string };

/**
 * Send one message per order to the people it belongs to: every active
 * account of the store (also for orders a rep or the office entered) and
 * the rep who entered it. Office staff aren't told about their own
 * changes. Never throws.
 */
async function tellOrderPeople(
  orderIds: string[],
  message: (order: { id: string; order_number: string }) => Message,
  label: string,
): Promise<void> {
  try {
    const ids = [...new Set(orderIds)];
    if (ids.length === 0) return;
    const admin = createAdminClient();
    const { data: orders } = await admin
      .from("orders")
      .select("id, order_number, supermarket_id, placed_by")
      .in("id", ids);
    if (!orders?.length) return;

    const storeIds = [...new Set(orders.map((o) => o.supermarket_id as string))];
    const placerIds = [...new Set(orders.map((o) => o.placed_by as string | null).filter((v): v is string => !!v))];
    const [{ data: buyers }, { data: placers }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, supermarket_id")
        .eq("role", "buyer")
        .eq("active", true)
        .in("supermarket_id", storeIds),
      placerIds.length
        ? admin.from("profiles").select("id, role").in("id", placerIds)
        : Promise.resolve({ data: [] as { id: string; role: string }[] }),
    ]);
    const roleOf = new Map((placers ?? []).map((p) => [p.id as string, p.role as string]));
    const buyersOf = new Map<string, string[]>();
    for (const b of buyers ?? []) {
      const list = buyersOf.get(b.supermarket_id as string) ?? [];
      list.push(b.id as string);
      buyersOf.set(b.supermarket_id as string, list);
    }

    const jobs: Parameters<typeof notify>[0][] = [];
    for (const o of orders) {
      const to = new Map<string, string>(); // user → link that opens the order for them
      for (const id of buyersOf.get(o.supermarket_id as string) ?? []) to.set(id, `/orders/${o.id}`);
      if (o.placed_by && roleOf.get(o.placed_by as string) === "rep") to.set(o.placed_by as string, `/rep/orders/${o.id}`);
      const m = message({ id: o.id as string, order_number: o.order_number as string });
      for (const [user_id, href] of to) {
        jobs.push({ user_id, kind: "order_status", title: m.title, body: m.body, href, order_id: o.id as string });
      }
    }

    // A few at a time — a run of 50 orders shouldn't go out one by one.
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) await notify(jobs[next++]);
    };
    await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, worker));
  } catch (e) {
    console.error(`[notify] ${label}:`, e);
  }
}

/**
 * Tell the people an order belongs to that its status changed.
 * Meant for after(); never throws.
 */
export async function notifyOrderStatus(orderIds: string[], status: OrderStatus): Promise<void> {
  await tellOrderPeople(
    orderIds,
    (o) => ({
      title: `${o.order_number} · ${STATUS_LABELS[status]}`,
      body: BODY[status] ?? `Шинэ төлөв: ${STATUS_LABELS[status]}`,
    }),
    "order status",
  );
}

/**
 * Tell the store that BDI corrected its order (quantities changed at
 * delivery, a product added or taken off), with the old and new amount.
 * Meant for after(); never throws.
 */
export async function notifyOrderCorrected(orderId: string, totalBefore: number, totalAfter: number): Promise<void> {
  await tellOrderPeople(
    [orderId],
    (o) => ({
      title: `${o.order_number} · Захиалга шинэчлэгдлээ`,
      body:
        Math.round(totalBefore) === Math.round(totalAfter)
          ? "Барааны жагсаалт өөрчлөгдлөө."
          : `Төлөх дүн ${formatMnt(totalBefore)} → ${formatMnt(totalAfter)} боллоо.`,
    }),
    "order corrected",
  );
}
