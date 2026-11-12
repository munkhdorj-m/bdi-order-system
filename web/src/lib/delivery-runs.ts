import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { needsFix43 } from "@/lib/orders/correct";
import { isUuid } from "@/lib/orders/write";
import { addDays, todayUb, type ShipmentStatus } from "@/lib/dispatch";
import type { OrderStatus } from "@/lib/order-status";
import type { PaymentMethod } from "@/lib/payment-method";

/**
 * The delivery person's side of a delivery run (/rep/delivery): the runs
 * they take out, with each order they have to hand over.
 *
 * A rep's own database access covers only their assigned stores, and a
 * run goes to any store — so these read with the service role, after
 * checking that the signed-in user really is the run's Түгээгч
 * (distributors.profile_id, fix 43). Every function takes the user id and
 * does that check itself.
 */

export type MyDistributor = { id: string; name: string };

/** The Түгээгч this login is linked to. `setup` = fix 43 hasn't been run. */
export async function myDistributor(userId: string): Promise<{ distributor: MyDistributor | null; setup: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("distributors")
    .select("id, name")
    .eq("profile_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (error) return { distributor: null, setup: needsFix43(error) };
  return { distributor: (data as MyDistributor | null) ?? null, setup: false };
}

export type RunOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  amount: number;
  payment_method: PaymentMethod | null;
  notes: string | null;
  pieces: number;
  store: { name: string; address: string | null; phone: string | null; district: string | null };
};

export type MyRun = {
  id: string;
  shipment_no: number;
  delivery_date: string;
  status: ShipmentStatus;
  orders: RunOrder[];
};

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  shipment_id: string;
  store: { name: string; address: string | null; contact_phone: string | null; district: string | null } | null;
  items: { qty: number }[];
};

/** How far back a run with undelivered orders still shows. */
const LOOK_BACK_DAYS = 7;

/**
 * This delivery person's runs: today's and tomorrow's, plus any from the
 * last week that still has an order on the road.
 */
export async function loadMyRuns(distributorId: string): Promise<MyRun[]> {
  const admin = createAdminClient();
  const today = todayUb();
  const { data: runs, error } = await admin
    .from("shipments")
    .select("id, shipment_no, delivery_date, status")
    .eq("distributor_id", distributorId)
    .gte("delivery_date", addDays(today, -LOOK_BACK_DAYS))
    .lte("delivery_date", addDays(today, 1))
    .order("delivery_date", { ascending: false })
    .order("shipment_no", { ascending: false });
  if (error) throw new Error(error.message);
  const list = (runs ?? []) as { id: string; shipment_no: number; delivery_date: string; status: ShipmentStatus }[];
  if (list.length === 0) return [];

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select(
      "id, order_number, status, subtotal, discount_total, payment_method, notes, shipment_id, store:supermarket_id(name, address, contact_phone, district), items:order_items(qty)",
    )
    .in(
      "shipment_id",
      list.map((r) => r.id),
    )
    .neq("status", "cancelled")
    .order("order_number", { ascending: true })
    .limit(1000);
  if (ordersError) throw new Error(ordersError.message);

  const byRun = new Map<string, RunOrder[]>();
  for (const o of (orders ?? []) as unknown as OrderRow[]) {
    const row: RunOrder = {
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      amount: Math.max(0, Number(o.subtotal) - Number(o.discount_total ?? 0)),
      payment_method: o.payment_method,
      notes: o.notes,
      pieces: (o.items ?? []).reduce((s, i) => s + Number(i.qty), 0),
      store: {
        name: o.store?.name ?? "—",
        address: o.store?.address ?? null,
        phone: o.store?.contact_phone ?? null,
        district: o.store?.district?.replace(/\s+/g, " ").trim() || null,
      },
    };
    const run = byRun.get(o.shipment_id);
    if (run) run.push(row);
    else byRun.set(o.shipment_id, [row]);
  }

  return list
    .map((r) => ({ ...r, orders: byRun.get(r.id) ?? [] }))
    .filter(
      (r) =>
        // Old runs only while something on them is still out for delivery.
        r.delivery_date >= today || r.orders.some((o) => o.status === "shipped"),
    );
}

export type DeliveryOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  updated_at: string;
  subtotal: number;
  discount_total: number;
  payment_method: PaymentMethod | null;
  notes: string | null;
  /** A store's own order: discounts and gifts follow a changed quantity. */
  hasDeals: boolean;
  shipment: { id: string; shipment_no: number; delivery_date: string; status: ShipmentStatus };
  store: {
    name: string;
    address: string | null;
    phone: string | null;
    district: string | null;
    lat: number | null;
    lng: number | null;
  };
  lines: { id: string; product_id: string; name: string; qty: number; unit_price: number; box_count: number | null }[];
};

/**
 * One order of a run this user delivers — or why not. Used by the page
 * and by every delivery action, so the "is this yours?" check lives in
 * one place.
 */
export async function loadDeliveryOrder(
  orderId: string,
  userId: string,
): Promise<{ order: DeliveryOrder } | { error: string }> {
  if (!isUuid(orderId)) return { error: "Захиалга олдсонгүй." };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      `id, order_number, status, updated_at, subtotal, discount_total, payment_method, notes,
       placer:placed_by(role),
       shipment:shipment_id(id, shipment_no, delivery_date, status, distributor:distributor_id(profile_id, active)),
       store:supermarket_id(name, address, contact_phone, district, lat, lng),
       lines:order_items(id, product_id, name:product_name_snapshot, qty, unit_price, product:product_id(box_count))`,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { error: needsFix43(error) ? "Хүргэлтийн дэлгэц хараахан идэвхжээгүй байна. Оффистой холбогдоно уу." : error.message };

  type Row = {
    id: string;
    order_number: string;
    status: OrderStatus;
    updated_at: string;
    subtotal: number;
    discount_total: number | null;
    payment_method: PaymentMethod | null;
    notes: string | null;
    placer: { role: string } | null;
    shipment: {
      id: string;
      shipment_no: number;
      delivery_date: string;
      status: ShipmentStatus;
      distributor: { profile_id: string | null; active: boolean } | null;
    } | null;
    store: {
      name: string;
      address: string | null;
      contact_phone: string | null;
      district: string | null;
      lat: number | null;
      lng: number | null;
    } | null;
    lines: { id: string; product_id: string; name: string; qty: number; unit_price: number; product: { box_count: number | null } | null }[];
  };
  const o = data as unknown as Row | null;
  // Not on one of this user's runs: say no more than "not found".
  if (!o || !o.shipment || o.shipment.distributor?.profile_id !== userId || o.shipment.distributor.active === false) {
    return { error: "Захиалга олдсонгүй." };
  }

  return {
    order: {
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      updated_at: o.updated_at,
      subtotal: Number(o.subtotal) || 0,
      discount_total: Number(o.discount_total) || 0,
      payment_method: o.payment_method,
      notes: o.notes,
      hasDeals: o.placer?.role === "buyer",
      shipment: {
        id: o.shipment.id,
        shipment_no: o.shipment.shipment_no,
        delivery_date: o.shipment.delivery_date,
        status: o.shipment.status,
      },
      store: {
        name: o.store?.name ?? "—",
        address: o.store?.address ?? null,
        phone: o.store?.contact_phone ?? null,
        district: o.store?.district?.replace(/\s+/g, " ").trim() || null,
        lat: o.store?.lat ?? null,
        lng: o.store?.lng ?? null,
      },
      lines: [...(o.lines ?? [])]
        .map((l) => ({
          id: l.id,
          product_id: l.product_id,
          name: l.name,
          qty: Number(l.qty),
          unit_price: Number(l.unit_price),
          box_count: l.product?.box_count ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "mn")),
    },
  };
}
