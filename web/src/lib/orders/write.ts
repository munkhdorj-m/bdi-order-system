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
  | {
      orderId: string;
      orderNumber: string;
      /** true = this checkout id already had an order; nothing new was written. */
      duplicate: boolean;
      /** For a duplicate: when that earlier order was placed and where it stands. */
      createdAt?: string;
      status?: string;
    }
  | { error: string };

/** What a checkout tells the phone when its id already had an order. */
export type DuplicateOrder = {
  createdAt: string;
  status: string;
  /** How long ago it was placed, by the server's clock (a phone's can be off). */
  ageMs: number;
};

export function duplicateInfo(w: WriteOrderResult): DuplicateOrder | undefined {
  if ("error" in w || !w.duplicate || !w.createdAt) return undefined;
  const placed = Date.parse(w.createdAt);
  return {
    createdAt: w.createdAt,
    status: w.status ?? "pending",
    ageMs: Number.isFinite(placed) ? Math.max(0, Date.now() - placed) : 0,
  };
}

/**
 * The order row is written first and its lines second, so a send that dies
 * in between leaves an order with no lines. A send that is merely slow can
 * still add its lines for a while (a database call is given up on after
 * 5 minutes at the latest). Past this, the empty order is abandoned and the
 * next send of the same checkout fills it in.
 */
const ABANDONED_AFTER_MS = 6 * 60 * 1000;

/** How long a send waits for an earlier send of the same checkout to finish. */
const SETTLE_WAITS_MS = [700, 1300];

const STILL_SENDING =
  "Өмнөх илгээлт бүрэн дуусаагүй байна. Хэдэн минутын дараа дахин илгээнэ үү — захиалга давхардахгүй.";

type OrderLine = NewOrderItem & { order_id: string };

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

  const lines = (orderId: string): OrderLine[] => items.map((i) => ({ ...i, order_id: orderId }));

  if (id) {
    const earlier = await settleEarlierSend(admin, id, order, lines(id));
    if (earlier) return earlier;
  }

  const { data: number, error: numErr } = await admin.rpc("generate_order_number");
  if (numErr || !number) {
    return { error: numErr?.message ?? "Захиалгын дугаар үүсгэж чадсангүй." };
  }

  const { data: row, error: orderErr } = await admin
    .from("orders")
    .insert({ ...order, ...(id ? { id } : {}), order_number: number as string, status: "pending" })
    .select("id, order_number, updated_at")
    .single();
  if (orderErr || !row) {
    // The same checkout arrived twice at once and the other one won.
    if (id && orderErr?.code === "23505") {
      const earlier = await settleEarlierSend(admin, id, order, lines(id));
      if (earlier) return earlier;
      return { error: "Захиалга үүсгэхэд алдаа гарлаа. Дахин илгээнэ үү." };
    }
    return { error: orderErr?.message ?? "Захиалга үүсгэхэд алдаа гарлаа." };
  }

  const { error: itemsErr } = await admin.from("order_items").insert(lines(row.id as string));
  if (itemsErr) {
    // No empty order left behind, so a retry starts clean — but only while
    // the order is exactly as we just wrote it. If the lines did land after
    // all (only the answer got lost), the database has since added them up
    // (`subtotal`) and stamped the order (`updated_at`): keep it.
    await admin
      .from("orders")
      .delete()
      .eq("id", row.id)
      .eq("updated_at", row.updated_at as string)
      .eq("subtotal", 0);
    return { error: itemsErr.message };
  }

  // orders.subtotal is filled in by the recompute_order_subtotal trigger.
  return { orderId: row.id as string, orderNumber: row.order_number as string, duplicate: false };
}

type OwnOrder = {
  order: { orderId: string; orderNumber: string; duplicate: true; createdAt: string; status: string };
  /** Known for certain to have no lines (a count we couldn't read is NOT "empty"). */
  empty: boolean;
};

async function findOwnOrder(
  admin: SupabaseClient,
  id: string,
  userId: string,
): Promise<OwnOrder | { error: string } | null> {
  const { data } = await admin
    .from("orders")
    .select("id, order_number, placed_by, status, created_at, order_items(count)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  // Someone else's id: say nothing about it.
  if (data.placed_by !== userId) return { error: "Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу." };
  const counted = data.order_items as unknown as { count?: unknown }[] | null;
  return {
    order: {
      orderId: data.id as string,
      orderNumber: data.order_number as string,
      duplicate: true,
      createdAt: data.created_at as string,
      status: data.status as string,
    },
    empty: Array.isArray(counted) && counted.length === 1 && counted[0]?.count === 0,
  };
}

/**
 * What an earlier send of this checkout left behind.
 *  - Nothing: null — write the order now.
 *  - A complete order: that order (`duplicate: true`).
 *  - An order with no lines yet: the earlier send is either still writing
 *    them (wait a moment for it) or died half-way (fill the order in, once
 *    it is certainly abandoned). Never both — that would double the lines.
 */
async function settleEarlierSend(
  admin: SupabaseClient,
  id: string,
  order: NewOrder,
  lines: OrderLine[],
): Promise<WriteOrderResult | null> {
  for (let attempt = 0; ; attempt++) {
    const found = await findOwnOrder(admin, id, order.placed_by);
    if (!found) return null;
    if ("error" in found) return found;
    if (!found.empty || found.order.status !== "pending") return found.order;

    const filled = await fillAbandonedOrder(admin, id, order, lines);
    if (filled) return filled;

    const wait = SETTLE_WAITS_MS[attempt];
    if (wait === undefined) return { error: STILL_SENDING };
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/**
 * Fill in an order that was left without lines — only if nothing has
 * touched it for ABANDONED_AFTER_MS, and only one caller at a time: the
 * UPDATE moves `updated_at` forward, so of several callers it matches (and
 * claims) the order for exactly one. null = not ours to fill (yet).
 */
async function fillAbandonedOrder(
  admin: SupabaseClient,
  id: string,
  order: NewOrder,
  lines: OrderLine[],
): Promise<WriteOrderResult | null> {
  // We are about to add lines to an existing order: be certain it has none.
  const { data: anyLine, error: readErr } = await admin
    .from("order_items")
    .select("id")
    .eq("order_id", id)
    .limit(1);
  if (readErr || !anyLine || anyLine.length > 0) return null;

  const now = Date.now();
  const { data: claimed, error: claimErr } = await admin
    .from("orders")
    // The order is really being placed now: this send's note, payment and
    // discount, and the time it shows up in the office's list.
    .update({ ...order, created_at: new Date(now).toISOString() })
    .eq("id", id)
    .eq("placed_by", order.placed_by)
    .eq("supermarket_id", order.supermarket_id)
    .eq("status", "pending")
    .lt("updated_at", new Date(now - ABANDONED_AFTER_MS).toISOString())
    .select("id, order_number");
  if (claimErr || !claimed || claimed.length !== 1) return null;

  const { error } = await admin.from("order_items").insert(lines);
  if (error) return { error: error.message };
  return { orderId: id, orderNumber: claimed[0].order_number as string, duplicate: false };
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
