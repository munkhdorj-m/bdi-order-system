import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/lib/order-status";
import type { PaymentMethod } from "@/lib/payment-method";
import { addDays, ubDayStart, type ShipmentStatus } from "@/lib/dispatch";

/**
 * Orders with everything the paper side needs — delivery notes, the
 * loading list, Excel exports and e-Barimt receipts — in one query.
 * Needs fix 37 (shipments, orders.shipment_id / delivery_date).
 */

export type DocItem = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  product: {
    sku: string | null;
    internal_code: string | null;
    unit: string | null;
    box_count: number | null;
    vat_payable: boolean | null;
    city_tax: boolean | null;
    ebarimt_class_code: string | null;
    ebarimt_tax_code: string | null;
  } | null;
};

export type DocOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  shipped_at: string | null;
  delivery_date: string | null;
  shipment_id: string | null;
  store: {
    id: string;
    name: string;
    address: string | null;
    contact_phone: string | null;
    registry_number: string | null;
    external_id: string | null;
    type: string | null;
    district: string | null;
    ebarimt_tin: string | null;
  } | null;
  placedBy: { full_name: string | null; phone: string | null; role: string | null } | null;
  shipment: {
    shipment_no: number;
    delivery_date: string;
    status: ShipmentStatus;
    distributor: { name: string; phone: string | null; vehicle: string | null } | null;
  } | null;
  items: DocItem[];
};

const SELECT = `id, order_number, status, subtotal, discount_total, payment_method, notes, created_at, shipped_at, delivery_date, shipment_id,
  store:supermarket_id(id, name, address, contact_phone, registry_number, external_id, type, district, ebarimt_tin),
  placedBy:placed_by(full_name, phone, role),
  shipment:shipment_id(shipment_no, delivery_date, status, distributor:distributor_id(name, phone, vehicle)),
  items:order_items(product_id, name:product_name_snapshot, qty, unit_price, line_total,
    product:product_id(sku, internal_code, unit, box_count, vat_payable, city_tax, ebarimt_class_code, ebarimt_tax_code))`;

export type DocFilter =
  | { orderIds: string[] }
  | { shipmentId: string }
  /** Every non-cancelled order planned for or shipped on a delivery day. */
  | { deliveryDate: string }
  /** Orders placed between two UB days (inclusive); cancelled only if asked for. */
  | { createdFrom: string; createdTo: string; status?: OrderStatus | null };

/** Load orders for documents, oldest order number first (pages past the 1,000-row cap). */
export async function loadDocOrders(
  supabase: SupabaseClient,
  filter: DocFilter,
): Promise<DocOrder[]> {
  if ("orderIds" in filter && filter.orderIds.length === 0) return [];
  const build = () => {
    let q = supabase.from("orders").select(SELECT);
    if ("orderIds" in filter) {
      q = q.in("id", filter.orderIds);
    } else if ("shipmentId" in filter) {
      q = q.eq("shipment_id", filter.shipmentId).neq("status", "cancelled");
    } else if ("deliveryDate" in filter) {
      q = q.eq("delivery_date", filter.deliveryDate).neq("status", "cancelled");
    } else {
      q = q
        .gte("created_at", ubDayStart(filter.createdFrom))
        .lt("created_at", ubDayStart(addDays(filter.createdTo, 1)));
      q = filter.status ? q.eq("status", filter.status) : q.neq("status", "cancelled");
    }
    return q.order("order_number", { ascending: true });
  };

  const rows: DocOrder[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await build().range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as DocOrder[]));
    if (!data || data.length < 1000) break;
  }
  return rows.map((o) => ({
    ...o,
    subtotal: Number(o.subtotal) || 0,
    discount_total: Number(o.discount_total) || 0,
    items: [...(o.items ?? [])]
      .map((i) => ({ ...i, unit_price: Number(i.unit_price) || 0, line_total: Number(i.line_total) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, "mn")),
  }));
}

/** What the store pays: lines minus the order-level discount. */
export function amountDue(o: Pick<DocOrder, "subtotal" | "discount_total">): number {
  return Math.max(0, o.subtotal - (o.discount_total || 0));
}
