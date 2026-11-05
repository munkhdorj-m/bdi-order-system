import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DispatchBoard,
  type BoardDistributor,
  type BoardOrder,
  type BoardProductLine,
  type BoardShipment,
} from "@/components/admin/dispatch-board";
import { isIsoDay, splitBoxes, todayUb, type ShipmentStatus } from "@/lib/dispatch";
import { resolveDeliveryDay } from "@/lib/delivery";
import type { OrderStatus } from "@/lib/order-status";
import type { PaymentMethod } from "@/lib/payment-method";

type SearchParams = Promise<{ date?: string; shipment?: string }>;

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  delivery_date: string | null;
  shipment_id: string | null;
  store: {
    name: string;
    address: string | null;
    contact_phone: string | null;
    registry_number: string | null;
    district: string | null;
    delivery_day: number | null;
  } | null;
  placedBy: { full_name: string | null; phone: string | null; role: string | null } | null;
  items: {
    product_id: string;
    name: string;
    qty: number;
    line_total: number;
    product: { internal_code: string | null; sku: string | null; box_count: number | null } | null;
  }[];
};

const ORDER_SELECT = `id, order_number, status, subtotal, discount_total, payment_method, notes, created_at, delivery_date, shipment_id,
  store:supermarket_id(name, address, contact_phone, registry_number, district, delivery_day),
  placedBy:placed_by(full_name, phone, role),
  items:order_items(product_id, name:product_name_snapshot, qty, line_total, product:product_id(internal_code, sku, box_count))`;

function toBoardOrder(o: OrderRow): BoardOrder {
  let pieces = 0;
  let boxes = 0;
  for (const i of o.items ?? []) {
    pieces += i.qty;
    boxes += splitBoxes(i.qty, i.product?.box_count).boxes;
  }
  return {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    created_at: o.created_at,
    delivery_date: o.delivery_date,
    payment_method: o.payment_method,
    notes: o.notes,
    amount: Math.max(0, Number(o.subtotal) - Number(o.discount_total ?? 0)),
    pieces,
    boxes,
    lines: o.items?.length ?? 0,
    store: {
      name: o.store?.name ?? "—",
      address: o.store?.address ?? null,
      phone: o.store?.contact_phone ?? null,
      registry: o.store?.registry_number ?? null,
      weekday: resolveDeliveryDay({
        storeDeliveryDay: o.store?.delivery_day ?? null,
        district: o.store?.district ?? null,
      }),
    },
    placedBy: o.placedBy?.full_name || o.placedBy?.phone || null,
    placedByBuyer: o.placedBy?.role === "buyer",
  };
}

/**
 * Хүргэлт хуваарлах — Mercury's dispatch screen. Left: orders not on a
 * delivery run yet. Right: the day's runs (Ачилт); pick one, add orders,
 * print the delivery notes and loading list, then close it.
 */
export default async function DispatchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const date = isIsoDay(sp.date) ? sp.date : todayUb();
  const supabase = await createClient();

  const [unassignedRes, shipmentsRes, distributorsRes] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .is("shipment_id", null)
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("shipments")
      .select("id, shipment_no, status, notes, created_at, closed_at, distributor:distributor_id(id, name, phone)")
      .eq("delivery_date", date)
      .order("shipment_no", { ascending: true }),
    supabase.from("distributors").select("id, name, phone, active").order("name"),
  ]);

  const setupError = unassignedRes.error ?? shipmentsRes.error ?? distributorsRes.error;
  if (setupError) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">Хүргэлт хуваарлах</h1>
        <Card className="p-6 text-sm">
          <div className="font-medium mb-1">Хүргэлтийн хүснэгтүүд бэлэн биш байна.</div>
          <p className="text-muted-foreground">
            Supabase SQL Editor дээр <code>docs/fixes/37-dispatch-and-ebarimt.sql</code>-ийг ажиллуулна уу.
          </p>
          <p className="text-muted-foreground mt-2 break-words">Алдаа: {setupError.message}</p>
        </Card>
      </div>
    );
  }

  const shipmentRows = (shipmentsRes.data ?? []) as unknown as {
    id: string;
    shipment_no: number;
    status: ShipmentStatus;
    notes: string | null;
    created_at: string;
    closed_at: string | null;
    distributor: { id: string; name: string; phone: string | null } | null;
  }[];

  // Orders on the day's runs (for counts, the selected run's list and its product summary).
  const shipmentIds = shipmentRows.map((s) => s.id);
  const assignedRes = shipmentIds.length
    ? await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .in("shipment_id", shipmentIds)
        .neq("status", "cancelled")
        .order("order_number", { ascending: true })
    : { data: [], error: null };
  const assigned = ((assignedRes.data ?? []) as unknown as OrderRow[]);

  const shipments: BoardShipment[] = shipmentRows.map((s) => {
    const mine = assigned.filter((o) => o.shipment_id === s.id);
    return {
      id: s.id,
      shipment_no: s.shipment_no,
      status: s.status,
      notes: s.notes,
      created_at: s.created_at,
      closed_at: s.closed_at,
      distributor: s.distributor,
      orderCount: mine.length,
      amount: mine.reduce((sum, o) => sum + Math.max(0, Number(o.subtotal) - Number(o.discount_total ?? 0)), 0),
    };
  });

  const selected =
    shipments.find((s) => s.id === sp.shipment) ??
    shipments.find((s) => s.status === "open") ??
    shipments[0] ??
    null;

  const selectedOrders = selected ? assigned.filter((o) => o.shipment_id === selected.id) : [];

  // Product summary for loading (Нэгтгэл), biggest first.
  const byProduct = new Map<string, BoardProductLine & { perBox: number | null }>();
  for (const o of selectedOrders) {
    for (const i of o.items ?? []) {
      const cur = byProduct.get(i.product_id) ?? {
        product_id: i.product_id,
        name: i.name.replace(/^🎁\s*/, ""),
        code: i.product?.internal_code ?? i.product?.sku ?? null,
        qty: 0,
        boxes: 0,
        loose: 0,
        amount: 0,
        perBox: i.product?.box_count ?? null,
      };
      cur.qty += i.qty;
      cur.amount += Number(i.line_total) || 0;
      byProduct.set(i.product_id, cur);
    }
  }
  const productLines: BoardProductLine[] = [...byProduct.values()]
    .map(({ perBox, ...p }) => ({ ...p, ...splitBoxes(p.qty, perBox) }))
    .sort((a, b) => b.qty - a.qty);

  const distributors: BoardDistributor[] = ((distributorsRes.data ?? []) as BoardDistributor[]).filter(
    (d) => d.active !== false,
  );

  return (
    <div className="max-w-7xl">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Хүргэлт хуваарлах</h1>
          <p className="text-[13px] text-muted-foreground">
            Захиалгыг ачилтад хуваарилж, падаан, нэгтгэл хэвлээд ачилтаа хаана.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/orders/new">
            <Plus className="h-4 w-4" />
            Шинэ захиалга
          </Link>
        </Button>
      </div>

      <DispatchBoard
        key={date}
        date={date}
        today={todayUb()}
        unassigned={((unassignedRes.data ?? []) as unknown as OrderRow[]).map(toBoardOrder)}
        shipments={shipments}
        selectedId={selected?.id ?? null}
        selectedOrders={selectedOrders.map(toBoardOrder)}
        productLines={productLines}
        distributors={distributors}
      />
    </div>
  );
}
