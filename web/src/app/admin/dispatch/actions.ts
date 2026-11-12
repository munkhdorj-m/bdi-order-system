"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError, getSession } from "@/lib/auth";
import { isIsoDay } from "@/lib/dispatch";
import { LIVE_STATUSES } from "@/lib/ebarimt";
import { notifyOrderStatus } from "@/lib/orders/status-notify";

/**
 * Daily dispatch — Mercury's "Захиалгын хүргэлт хуваарлах" and
 * "Хаасан захиалгын жагсаалт":
 *
 *   createShipment   new delivery run (Ачилт) for a day + distributor
 *   assignOrders     put orders on an open run (pending → confirmed)
 *   unassignOrders   take them off again
 *   closeShipment    loaded & gone: run closed, its orders → shipped
 *   reopenShipment   undo a close (refused once e-Barimt was sent)
 *   markDelivered / markShipmentDelivered
 *                    the store has the goods: shipped → delivered
 *   returnToQueue    not delivered after all: back to the unplanned list
 *
 * Everything needs fix 37.
 */

type Result = { error?: string; id?: string; count?: number };

function refresh() {
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/ebarimt");
  revalidatePath("/admin");
}

function uniqueIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

/** Most orders one click may move — refused above this, never cut quietly. */
const MAX_IDS = 1000;
const TOO_MANY = `Нэг удаад ${MAX_IDS} хүртэл захиалга.`;

/** Order ids per request — keeps `id=in.(…)` URLs short. */
const ID_CHUNK = 100;

function chunked<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function loadShipment(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("shipments")
    .select("id, shipment_no, delivery_date, status")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Ачилт олдсонгүй." };
  return { shipment: data as { id: string; shipment_no: number; delivery_date: string; status: "open" | "closed" } };
}


export async function createShipment(input: {
  deliveryDate: string;
  distributorId: string | null;
  newDistributorName?: string | null;
  newDistributorPhone?: string | null;
  notes?: string | null;
}): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const session = await getSession();
  if (!isIsoDay(input.deliveryDate)) return { error: "Хүргэх өдөр буруу байна." };

  const supabase = await createClient();
  let distributorId = input.distributorId || null;
  const newName = input.newDistributorName?.trim();
  if (!distributorId && newName) {
    const { data, error } = await supabase
      .from("distributors")
      .insert({ name: newName.slice(0, 80), phone: input.newDistributorPhone?.trim().slice(0, 30) || null })
      .select("id")
      .single();
    if (error) {
      return {
        error: /duplicate|unique/i.test(error.message)
          ? "Ийм нэртэй түгээгч бүртгэлтэй байна — жагсаалтаас сонгоно уу."
          : error.message,
      };
    }
    distributorId = data.id as string;
  }

  const { data, error } = await supabase
    .from("shipments")
    .insert({
      delivery_date: input.deliveryDate,
      distributor_id: distributorId,
      notes: input.notes?.trim().slice(0, 500) || null,
      created_by: session?.userId ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  refresh();
  return { id: data.id as string };
}

export async function setShipmentDistributor(
  shipmentId: string,
  distributorId: string | null,
): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const supabase = await createClient();
  const { error } = await supabase
    .from("shipments")
    .update({ distributor_id: distributorId || null })
    .eq("id", shipmentId);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function assignOrders(shipmentId: string, orderIds: string[]): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const ids = uniqueIds(orderIds);
  if (ids.length === 0) return { error: "Захиалга сонгоно уу." };
  if (ids.length > MAX_IDS) return { error: TOO_MANY };

  const supabase = await createClient();
  const loaded = await loadShipment(supabase, shipmentId);
  if (loaded.error) return { error: loaded.error };
  const shipment = loaded.shipment!;
  if (shipment.status !== "open") return { error: "Ачилт хаагдсан байна. Эхлээд буцааж нээнэ үү." };

  // Only active orders that aren't on another run yet. In chunks, so a big
  // "assign all" doesn't build an overlong request URL.
  const moved: { id: string; order_number: string; status: string; placed_by: string }[] = [];
  for (const chunk of chunked(ids, ID_CHUNK)) {
    const { data, error } = await supabase
      .from("orders")
      .update({ shipment_id: shipment.id, delivery_date: shipment.delivery_date })
      .in("id", chunk)
      .is("shipment_id", null)
      .in("status", ["pending", "confirmed"])
      .select("id, order_number, status, placed_by");
    if (error) {
      if (moved.length > 0) refresh();
      return { count: moved.length, error: error.message };
    }
    moved.push(...((data ?? []) as typeof moved));
  }

  // Scheduling a pending order is accepting it.
  const pending = moved.filter((o) => o.status === "pending");
  if (pending.length > 0) {
    for (const chunk of chunked(pending.map((o) => o.id), ID_CHUNK)) {
      const { error: confirmErr } = await supabase
        .from("orders")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .in("id", chunk);
      if (confirmErr) {
        refresh();
        return { count: moved.length, error: confirmErr.message };
      }
    }
    after(() =>
      notifyOrderStatus(
        pending.map((o) => o.id as string),
        "confirmed",
      ),
    );
  }

  refresh();
  const count = moved.length;
  if (count < ids.length) {
    return {
      count,
      error:
        count === 0
          ? "Сонгосон захиалгууд өөр ачилтад орсон эсвэл идэвхгүй байна."
          : `${ids.length - count} захиалга өөр ачилтад орсон эсвэл идэвхгүй тул алгаслаа.`,
    };
  }
  return { count };
}

export async function unassignOrders(orderIds: string[]): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const ids = uniqueIds(orderIds);
  if (ids.length === 0) return { error: "Захиалга сонгоно уу." };
  if (ids.length > MAX_IDS) return { error: TOO_MANY };

  const supabase = await createClient();
  const removable: string[] = [];
  for (const chunk of chunked(ids, ID_CHUNK)) {
    const { data: rows, error } = await supabase
      .from("orders")
      .select("id, shipment:shipment_id(status)")
      .in("id", chunk);
    if (error) return { error: error.message };
    for (const r of rows ?? []) {
      if ((r.shipment as unknown as { status: string } | null)?.status === "open") removable.push(r.id as string);
    }
  }
  if (removable.length === 0) return { error: "Хаагдсан ачилтаас захиалга хасах боломжгүй." };

  let count = 0;
  for (const chunk of chunked(removable, ID_CHUNK)) {
    const { data: removed, error: updErr } = await supabase
      .from("orders")
      .update({ shipment_id: null })
      .in("id", chunk)
      .in("status", ["pending", "confirmed"])
      .select("id");
    if (updErr) {
      if (count > 0) refresh();
      return { count, error: updErr.message };
    }
    count += removed?.length ?? 0;
  }
  refresh();
  return { count };
}

export async function closeShipment(shipmentId: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const session = await getSession();

  const supabase = await createClient();
  const loaded = await loadShipment(supabase, shipmentId);
  if (loaded.error) return { error: loaded.error };
  if (loaded.shipment!.status !== "open") return { error: "Ачилт аль хэдийн хаагдсан." };

  const now = new Date().toISOString();
  // Anything still pending gets its confirmation stamp first.
  const { error: confirmErr } = await supabase
    .from("orders")
    .update({ status: "confirmed", confirmed_at: now })
    .eq("shipment_id", shipmentId)
    .eq("status", "pending");
  if (confirmErr) return { error: confirmErr.message };

  const { data: shipped, error: shipErr } = await supabase
    .from("orders")
    .update({ status: "shipped", shipped_at: now })
    .eq("shipment_id", shipmentId)
    .eq("status", "confirmed")
    .select("id, order_number, placed_by");
  if (shipErr) return { error: shipErr.message };
  if (!shipped || shipped.length === 0) {
    return { error: "Ачилтад хүргэх захиалга алга." };
  }

  const { error: closeErr } = await supabase
    .from("shipments")
    .update({ status: "closed", closed_at: now, closed_by: session?.userId ?? null })
    .eq("id", shipmentId);
  if (closeErr) return { error: closeErr.message };

  after(() =>
    notifyOrderStatus(
      shipped.map((o) => o.id as string),
      "shipped",
    ),
  );
  refresh();
  return { count: shipped.length };
}

export async function reopenShipment(shipmentId: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const supabase = await createClient();
  const loaded = await loadShipment(supabase, shipmentId);
  if (loaded.error) return { error: loaded.error };
  if (loaded.shipment!.status !== "closed") return { error: "Ачилт нээлттэй байна." };

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("shipment_id", shipmentId);
  if (error) return { error: error.message };
  const ids = (orders ?? []).map((o) => o.id as string);

  if ((orders ?? []).some((o) => o.status === "delivered")) {
    return { error: "Хүргэгдсэн захиалгатай ачилтыг буцааж нээх боломжгүй." };
  }
  if (ids.length > 0) {
    const { count, error: recErr } = await supabase
      .from("ebarimt_receipts")
      .select("id", { count: "exact", head: true })
      .in("order_id", ids)
      .in("status", LIVE_STATUSES);
    if (recErr) return { error: recErr.message };
    if ((count ?? 0) > 0) {
      return {
        error: `${count} захиалгад е-баримт илгээгдсэн эсвэл дараалалд байна. Эхлээд Е-баримт хуудсаас буцаана уу.`,
      };
    }
  }

  const { data: reopened, error: ordErr } = await supabase
    .from("orders")
    .update({ status: "confirmed", shipped_at: null })
    .eq("shipment_id", shipmentId)
    .eq("status", "shipped")
    .select("id");
  if (ordErr) return { error: ordErr.message };
  // Orders cancelled after the run left stay linked to the closed run for
  // its history; an open run doesn't keep them.
  const { error: detachErr } = await supabase
    .from("orders")
    .update({ shipment_id: null })
    .eq("shipment_id", shipmentId)
    .eq("status", "cancelled");
  if (detachErr) return { error: detachErr.message };

  const { error: openErr } = await supabase
    .from("shipments")
    .update({ status: "open", closed_at: null, closed_by: null })
    .eq("id", shipmentId);
  if (openErr) return { error: openErr.message };
  refresh();
  return { count: reopened?.length ?? 0 };
}

/**
 * Delivered: the store has the goods. Only orders that are out for
 * delivery ("shipped"); anything else in the selection is skipped and said.
 */
export async function markDelivered(orderIds: string[]): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const ids = uniqueIds(orderIds);
  if (ids.length === 0) return { error: "Захиалга сонгоно уу." };
  if (ids.length > MAX_IDS) return { error: TOO_MANY };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const done: string[] = [];
  for (const chunk of chunked(ids, ID_CHUNK)) {
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "delivered", delivered_at: now })
      .in("id", chunk)
      .eq("status", "shipped")
      .select("id");
    if (error) {
      if (done.length > 0) refresh();
      return { count: done.length, error: error.message };
    }
    done.push(...(data ?? []).map((o) => o.id as string));
  }
  if (done.length > 0) {
    after(() => notifyOrderStatus(done, "delivered"));
    refresh();
  }
  if (done.length < ids.length) {
    return {
      count: done.length,
      error:
        done.length === 0
          ? "Сонгосон захиалга хүргэлтэнд гараагүй (эсвэл аль хэдийн хүргэгдсэн) байна."
          : `${ids.length - done.length} захиалга хүргэлтэнд гараагүй тул алгаслаа.`,
    };
  }
  return { count: done.length };
}

/** How long a "delivered" ticked by mistake can be taken back from the board. */
const UNDO_DELIVERED_MS = 10 * 60 * 1000;

/**
 * Take back a "delivered" that was ticked by mistake a moment ago: the
 * order is out for delivery again. Only within a few minutes — after that
 * it is history (correct the lines on the order page instead).
 */
export async function undoDelivered(orderIds: string[]): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const ids = uniqueIds(orderIds);
  if (ids.length === 0) return { error: "Захиалга сонгоно уу." };
  if (ids.length > MAX_IDS) return { error: TOO_MANY };

  const supabase = await createClient();
  const since = new Date(Date.now() - UNDO_DELIVERED_MS).toISOString();
  let count = 0;
  for (const chunk of chunked(ids, ID_CHUNK)) {
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "shipped", delivered_at: null })
      .in("id", chunk)
      .eq("status", "delivered")
      .gte("delivered_at", since)
      .select("id");
    if (error) {
      if (count > 0) refresh();
      return { count, error: error.message };
    }
    count += data?.length ?? 0;
  }
  if (count > 0) refresh();
  if (count === 0) return { error: "Буцаах хугацаа өнгөрсөн байна." };
  return { count };
}

/** Every order of a closed run that is still out for delivery → delivered. */
export async function markShipmentDelivered(shipmentId: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const supabase = await createClient();
  const loaded = await loadShipment(supabase, shipmentId);
  if (loaded.error) return { error: loaded.error };
  if (loaded.shipment!.status !== "closed") return { error: "Эхлээд ачилтаа хаана уу." };

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("shipment_id", shipmentId)
    .eq("status", "shipped")
    .select("id");
  if (error) return { error: error.message };
  const done = (data ?? []).map((o) => o.id as string);
  if (done.length === 0) return { error: "Хүргэлтэнд яваа захиалга алга." };
  after(() => notifyOrderStatus(done, "delivered"));
  refresh();
  return { count: done.length };
}

/**
 * Not delivered after all (shop closed, nobody there): the order goes back
 * to the unplanned list to be put on another run. Refused once its
 * e-Barimt is sent or waiting — return the receipt first.
 */
export async function returnToQueue(orderIds: string[]): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const ids = uniqueIds(orderIds);
  if (ids.length === 0) return { error: "Захиалга сонгоно уу." };
  if (ids.length > MAX_IDS) return { error: TOO_MANY };

  const supabase = await createClient();
  const withReceipt = new Set<string>();
  for (const chunk of chunked(ids, ID_CHUNK)) {
    const { data, error } = await supabase
      .from("ebarimt_receipts")
      .select("order_id")
      .in("order_id", chunk)
      .in("status", LIVE_STATUSES);
    if (error) return { error: error.message };
    for (const r of data ?? []) withReceipt.add(r.order_id as string);
  }
  const movable = ids.filter((id) => !withReceipt.has(id));

  let count = 0;
  for (const chunk of chunked(movable, ID_CHUNK)) {
    const { data, error } = await supabase
      .from("orders")
      // The planned day stays: the board then lists it up front, marked as planned for an earlier day.
      .update({ status: "confirmed", shipped_at: null, shipment_id: null })
      .in("id", chunk)
      .eq("status", "shipped")
      .select("id");
    if (error) {
      if (count > 0) refresh();
      return { count, error: error.message };
    }
    count += data?.length ?? 0;
  }
  if (count > 0) refresh();
  if (withReceipt.size > 0) {
    return {
      count,
      error: `${withReceipt.size} захиалгад е-баримт илгээгдсэн тул буцаасангүй. Эхлээд Е-баримт хуудсаас баримтыг буцаана уу.`,
    };
  }
  if (count === 0) return { error: "Зөвхөн хүргэлтэнд яваа захиалгыг буцаана." };
  return { count };
}

export async function deleteShipment(shipmentId: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const supabase = await createClient();
  const loaded = await loadShipment(supabase, shipmentId);
  if (loaded.error) return { error: loaded.error };
  if (loaded.shipment!.status !== "open") return { error: "Хаагдсан ачилтыг устгах боломжгүй." };

  const { count, error: countErr } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId)
    .neq("status", "cancelled");
  if (countErr) return { error: countErr.message };
  if ((count ?? 0) > 0) return { error: "Эхлээд ачилтаас бүх захиалгыг хасна уу." };

  const { error } = await supabase.from("shipments").delete().eq("id", shipmentId);
  if (error) return { error: error.message };
  refresh();
  return {};
}
