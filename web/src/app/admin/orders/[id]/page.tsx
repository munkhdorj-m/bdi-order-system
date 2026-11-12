import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone, Printer, ReceiptText, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { OrderActions } from "@/components/admin/order-actions";
import { OrderLinesEditor } from "@/components/admin/order-lines-editor";
import { OrderTimeline } from "@/components/buyer/order-timeline";
import { Button } from "@/components/ui/button";
import { type OrderStatus } from "@/lib/order-status";
import { formatMnt } from "@/lib/format";
import { type PaymentMethod } from "@/lib/payment-method";
import { LIVE_STATUSES } from "@/lib/ebarimt";
import { FIX_43_HINT } from "@/lib/orders/correct";
import { diffLines } from "@/lib/orders/correction";

type Params = Promise<{ id: string }>;

type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivery_date: string | null;
  supermarket_id: string;
  supermarkets: {
    name: string;
    address: string | null;
    contact_phone: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
  } | null;
  /** Whoever placed the order — the store itself, a rep or an admin. */
  buyer: {
    full_name: string | null;
    phone: string | null;
    role: "admin" | "rep" | "buyer" | null;
  } | null;
  shipment: { id: string; shipment_no: number; delivery_date: string; status: string } | null;
  order_items: {
    id: string;
    product_id: string;
    product_name_snapshot: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }[];
};

type RecordedLine = { product_id: string; name: string; qty: number; unit_price: number };

type ChangeRow = {
  id: string;
  changed_at: string;
  reason: string | null;
  total_before: number;
  total_after: number;
  lines_before: RecordedLine[];
  lines_after: RecordedLine[];
  who: { full_name: string | null; phone: string | null } | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function storeInitial(name?: string | null) {
  return name?.trim()[0]?.toUpperCase() ?? "•";
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, subtotal, discount_total, payment_method, notes, created_at, updated_at, confirmed_at, shipped_at, delivered_at, delivery_date, supermarket_id,
       supermarkets:supermarket_id(name, address, contact_phone, profiles:assigned_rep_id(full_name, phone)),
       buyer:placed_by(full_name, phone, role),
       shipment:shipment_id(id, shipment_no, delivery_date, status),
       order_items(id, product_id, product_name_snapshot, qty, unit_price, line_total)`,
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const order = data as unknown as OrderDetail;

  // Corrections (fix 43) and the e-Barimt state decide whether the lines
  // can be changed. Read apart from the order itself, so the page still
  // opens before fix 43 has been run.
  const [orderedRes, changesRes, receiptRes] = await Promise.all([
    supabase.from("orders").select("ordered_total").eq("id", id).maybeSingle(),
    supabase
      .from("order_changes")
      .select("id, changed_at, reason, total_before, total_after, lines_before, lines_after, who:changed_by(full_name, phone)")
      .eq("order_id", id)
      .order("changed_at", { ascending: false })
      .limit(30),
    supabase
      .from("ebarimt_receipts")
      .select("id", { count: "exact", head: true })
      .eq("order_id", id)
      .in("status", LIVE_STATUSES),
  ]);
  const correctionsReady = !orderedRes.error && !changesRes.error;
  const orderedTotal =
    correctionsReady && orderedRes.data?.ordered_total != null ? Number(orderedRes.data.ordered_total) : null;
  const changes = (correctionsReady ? (changesRes.data ?? []) : []) as unknown as ChangeRow[];
  const lockedReason =
    order.status === "cancelled"
      ? "Цуцлагдсан захиалгыг засахгүй. Эхлээд сэргээнэ үү."
      : (receiptRes.count ?? 0) > 0
        ? "Е-баримт илгээгдсэн эсвэл дараалалд байгаа тул барааг засах боломжгүй. Эхлээд Е-баримт хуудсаас баримтыг буцаана уу."
        : !correctionsReady
          ? FIX_43_HINT
          : null;
  // The store card shows the STORE's phone; for orders entered by staff the
  // placer is the admin/rep, whose number used to show up there instead.
  const storePhone = order.supermarkets?.contact_phone ?? null;
  const placedByStore = order.buyer?.role === "buyer";
  const placerRole =
    order.buyer?.role === "admin" ? "админ" : order.buyer?.role === "rep" ? "төлөөлөгч" : "дэлгүүр";

  return (
    <div className="max-w-6xl">
      <Link
        href="/admin/orders"
        className="inline-flex items-center text-[12.5px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" />
        Захиалга жагсаалт руу
      </Link>

      {/* Header — title + status pill on left, OrderActions on right */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[26px] font-bold tracking-tight font-mono">
              {order.order_number}
            </h1>
            <OrderStatusPill status={order.status} size="md" />
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            {formatDateTime(order.created_at)}
          </p>
        </div>
        {/* May shrink, so on a narrow screen the buttons wrap instead of running off it. */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/print/invoices?orders=${order.id}`} target="_blank">
              <Printer className="h-4 w-4" />
              Падаан
            </Link>
          </Button>
          <OrderActions orderId={order.id} status={order.status} deliveryDate={order.delivery_date} />
        </div>
      </div>

      {/* 2/3 + 1/3 split. Stacks on small screens. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Store info card */}
          <div className="rounded-2xl bg-card ring-1 ring-border p-4 flex items-center gap-4 flex-wrap">
            <div className="size-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-base shrink-0">
              {storeInitial(order.supermarkets?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
                Дэлгүүр
              </div>
              <Link
                href={`/admin/supermarkets/${order.supermarket_id}`}
                className="block text-[15px] font-bold truncate hover:text-primary hover:underline"
              >
                {order.supermarkets?.name ?? "—"}
              </Link>
              <Link
                href={`/admin/orders?store=${order.supermarket_id}`}
                className="text-[12px] font-semibold text-primary hover:underline"
              >
                Энэ дэлгүүрийн бүх захиалга →
              </Link>
              {order.supermarkets?.address && (
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {order.supermarkets.address}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 text-[12.5px] min-w-0">
              {placedByStore && order.buyer?.full_name && (
                <div className="flex items-center gap-1.5">
                  <User
                    className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                    strokeWidth={2.2}
                  />
                  <span className="truncate">{order.buyer.full_name}</span>
                </div>
              )}
              {storePhone && (
                <div className="flex items-center gap-1.5">
                  <Phone
                    className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                    strokeWidth={2.2}
                  />
                  <a
                    href={`tel:${storePhone.replace(/\s/g, "")}`}
                    className="inline-flex min-h-10 items-center font-mono text-[12px] hover:text-primary"
                  >
                    {storePhone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Lines — with "Засах" to correct quantities after the order was placed */}
          <OrderLinesEditor
            orderId={order.id}
            storeId={order.supermarket_id}
            updatedAt={order.updated_at}
            lines={order.order_items.map((i) => ({
              id: i.id,
              product_id: i.product_id,
              name: i.product_name_snapshot,
              qty: Number(i.qty),
              unit_price: Number(i.unit_price),
              line_total: Number(i.line_total),
            }))}
            subtotal={Number(order.subtotal)}
            discountTotal={Number(order.discount_total ?? 0)}
            paymentMethod={order.payment_method}
            orderedTotal={orderedTotal}
            lockedReason={lockedReason}
            hasDeals={placedByStore}
          />

          {/* What was corrected, by whom and why */}
          {changes.length > 0 && (
            <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold tracking-tight">Засварын түүх</h2>
                <span className="text-[12px] text-muted-foreground">{changes.length} удаа</span>
              </div>
              <ul className="divide-y divide-border">
                {changes.map((c) => {
                  const diff = diffLines(c.lines_before ?? [], c.lines_after ?? []);
                  return (
                    <li key={c.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px]">
                        <span className="font-semibold">{c.who?.full_name || c.who?.phone || "—"}</span>
                        <span className="text-muted-foreground tabular-nums">{formatDateTime(c.changed_at)}</span>
                        {c.reason && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{c.reason}</span>
                        )}
                        <span className="ml-auto tabular-nums text-muted-foreground">
                          {formatMnt(c.total_before)} → <b className="text-foreground">{formatMnt(c.total_after)}</b>
                        </span>
                      </div>
                      {diff.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-[12px] text-muted-foreground">
                          {diff.map((d, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="min-w-0 flex-1 truncate">{d.name}</span>
                              <span className="shrink-0 tabular-nums">
                                {d.from === 0 ? "нэмсэн" : d.from} → {d.to === 0 ? "хассан" : <b className="text-foreground">{d.to}</b>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Amber note card — only when buyer left a note */}
          {order.notes && (
            <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-300/60 p-4 dark:bg-amber-950/30 dark:ring-amber-800/60">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-bold text-amber-900 dark:text-amber-200 mb-1.5">
                <ReceiptText className="h-3.5 w-3.5" strokeWidth={2.2} />
                Худалдан авагчийн тэмдэглэл
              </div>
              <p className="text-[13px] leading-relaxed text-amber-950 dark:text-amber-100 whitespace-pre-wrap">
                {order.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right column — timeline + meta facts */}
        <div className="rounded-2xl bg-card ring-1 ring-border p-5">
          <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-3">
            Төлвийн түүх
          </div>
          <OrderTimeline
            status={order.status}
            timestamps={{
              pending: order.created_at,
              confirmed: order.confirmed_at,
              shipped: order.shipped_at,
              delivered: order.delivered_at,
            }}
          />

          <div className="mt-5 pt-5 border-t border-border space-y-2 text-[12px]">
            <FactRow
              label="Захиалсан"
              value={`${order.buyer?.full_name ?? order.buyer?.phone ?? "—"}${order.buyer ? ` (${placerRole})` : ""}`}
            />
            {order.buyer?.full_name && order.buyer.phone && (
              <FactRow label="Захиалсан хүний утас" value={order.buyer.phone} mono />
            )}
            {order.shipment && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Ачилт</span>
                <Link
                  href={`/admin/dispatch?date=${order.shipment.delivery_date}&shipment=${order.shipment.id}`}
                  className="font-semibold text-right hover:text-primary hover:underline"
                >
                  №{order.shipment.shipment_no} · {order.shipment.delivery_date}
                  {order.shipment.status === "closed" ? " (хаасан)" : ""}
                </Link>
              </div>
            )}
            {order.supermarkets?.profiles?.full_name && (
              <FactRow
                label="Хариуцагч"
                value={order.supermarkets.profiles.full_name}
              />
            )}
            <FactRow
              label="Үүсгэгдсэн"
              value={formatDateTime(order.created_at)}
              mono
            />
            {order.delivered_at && (
              <FactRow
                label="Хүргэгдсэн"
                value={formatDateTime(order.delivered_at)}
                mono
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FactRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-semibold text-right truncate ${mono ? "font-mono text-[11.5px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
