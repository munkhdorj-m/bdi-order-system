"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminGuardError, getSession } from "@/lib/auth";
import { isIsoDay } from "@/lib/dispatch";
import { LIVE_STATUSES } from "@/lib/ebarimt";
import { notify } from "@/lib/notify";
import { STATUS_LABELS } from "@/lib/order-status";

/**
 * Daily dispatch — Mercury's "Захиалгын хүргэлт хуваарлах" and
 * "Хаасан захиалгын жагсаалт":
 *
 *   createShipment   new delivery run (Ачилт) for a day + distributor
 *   assignOrders     put orders on an open run (pending → confirmed)
 *   unassignOrders   take them off again
 *   closeShipment    loaded & gone: run closed, its orders → shipped
 *   reopenShipment   undo a close (refused once e-Barimt was sent)
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
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, 500);
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

/**
 * Tell buyers (not staff) about a status change on their orders. Runs in
 * after(), so it uses the service-role client rather than the request's
 * cookies, and never throws.
 */
async function notifyBuyers(
  orders: { id: string; order_number: string; placed_by: string }[],
  status: "confirmed" | "shipped",
) {
  if (orders.length === 0) return;
  const { data: people } = await createAdminClient()
    .from("profiles")
    .select("id, role")
    .in("id", [...new Set(orders.map((o) => o.placed_by))]);
  const buyers = new Set((people ?? []).filter((p) => p.role === "buyer").map((p) => p.id as string));
  for (const o of orders) {
    if (!buyers.has(o.placed_by)) continue;
    await notify({
      user_id: o.placed_by,
      kind: "order_status",
      title: `${o.order_number} · ${STATUS_LABELS[status]}`,
      body: status === "shipped" ? "Захиалга хүргэлтэнд гарлаа." : `Шинэ төлөв: ${STATUS_LABELS[status]}`,
      href: `/orders/${o.id}`,
      order_id: o.id,
    });
  }
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

  const supabase = await createClient();
  const loaded = await loadShipment(supabase, shipmentId);
  if (loaded.error) return { error: loaded.error };
  const shipment = loaded.shipment!;
  if (shipment.status !== "open") return { error: "Ачилт хаагдсан байна. Эхлээд буцааж нээнэ үү." };

  // Only active orders that aren't on another run yet.
  const { data: moved, error } = await supabase
    .from("orders")
    .update({ shipment_id: shipment.id, delivery_date: shipment.delivery_date })
    .in("id", ids)
    .is("shipment_id", null)
    .in("status", ["pending", "confirmed"])
    .select("id, order_number, status, placed_by");
  if (error) return { error: error.message };

  // Scheduling a pending order is accepting it.
  const pending = (moved ?? []).filter((o) => o.status === "pending");
  if (pending.length > 0) {
    const { error: confirmErr } = await supabase
      .from("orders")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .in("id", pending.map((o) => o.id as string));
    if (confirmErr) return { error: confirmErr.message };
    after(() =>
      notifyBuyers(
        pending.map((o) => ({ id: o.id as string, order_number: o.order_number as string, placed_by: o.placed_by as string })),
        "confirmed",
      ),
    );
  }

  refresh();
  const count = moved?.length ?? 0;
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

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("orders")
    .select("id, shipment:shipment_id(status)")
    .in("id", ids);
  if (error) return { error: error.message };
  const removable = (rows ?? [])
    .filter((r) => (r.shipment as unknown as { status: string } | null)?.status === "open")
    .map((r) => r.id as string);
  if (removable.length === 0) return { error: "Хаагдсан ачилтаас захиалга хасах боломжгүй." };

  const { error: updErr } = await supabase
    .from("orders")
    .update({ shipment_id: null })
    .in("id", removable)
    .in("status", ["pending", "confirmed"]);
  if (updErr) return { error: updErr.message };
  refresh();
  return { count: removable.length };
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
    notifyBuyers(
      shipped.map((o) => ({ id: o.id as string, order_number: o.order_number as string, placed_by: o.placed_by as string })),
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

  const { error: ordErr } = await supabase
    .from("orders")
    .update({ status: "confirmed", shipped_at: null })
    .eq("shipment_id", shipmentId)
    .eq("status", "shipped");
  if (ordErr) return { error: ordErr.message };

  const { error: openErr } = await supabase
    .from("shipments")
    .update({ status: "open", closed_at: null, closed_by: null })
    .eq("id", shipmentId);
  if (openErr) return { error: openErr.message };
  refresh();
  return { count: ids.length };
}

export async function deleteShipment(shipmentId: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const supabase = await createClient();
  const loaded = await loadShipment(supabase, shipmentId);
  if (loaded.error) return { error: loaded.error };
  if (loaded.shipment!.status !== "open") return { error: "Хаагдсан ачилтыг устгах боломжгүй." };

  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId);
  if ((count ?? 0) > 0) return { error: "Эхлээд ачилтаас бүх захиалгыг хасна уу." };

  const { error } = await supabase.from("shipments").delete().eq("id", shipmentId);
  if (error) return { error: error.message };
  refresh();
  return {};
}
