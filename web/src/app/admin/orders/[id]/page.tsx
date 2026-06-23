import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone, ReceiptText, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { OrderActions } from "@/components/admin/order-actions";
import { OrderTimeline } from "@/components/buyer/order-timeline";
import { type OrderStatus } from "@/lib/order-status";
import { formatMnt } from "@/lib/format";

type Params = Promise<{ id: string }>;

type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  payment_method: "cash" | "credit" | null;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  supermarkets: {
    name: string;
    address: string | null;
    contact_phone: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
  } | null;
  buyer: {
    full_name: string | null;
    phone: string | null;
  } | null;
  order_items: {
    id: string;
    product_name_snapshot: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }[];
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
      `id, order_number, status, subtotal, discount_total, payment_method, notes, created_at, confirmed_at, shipped_at, delivered_at,
       supermarkets:supermarket_id(name, address, contact_phone, profiles:assigned_rep_id(full_name, phone)),
       buyer:placed_by(full_name, phone),
       order_items(id, product_name_snapshot, qty, unit_price, line_total)`,
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const order = data as unknown as OrderDetail;

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
        <div className="shrink-0">
          <OrderActions orderId={order.id} status={order.status} />
        </div>
      </div>

      {/* 2/3 + 1/3 split. Stacks on small screens. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Store info card */}
          <div className="rounded-2xl bg-card ring-1 ring-border p-4 flex items-center gap-4 flex-wrap">
            <div className="size-11 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground flex items-center justify-center font-bold text-base shrink-0">
              {storeInitial(order.supermarkets?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
                Дэлгүүр
              </div>
              <div className="text-[15px] font-bold truncate">
                {order.supermarkets?.name ?? "—"}
              </div>
              {order.supermarkets?.address && (
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {order.supermarkets.address}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 text-[12.5px] min-w-0">
              {order.buyer?.full_name && (
                <div className="flex items-center gap-1.5">
                  <User
                    className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                    strokeWidth={2.2}
                  />
                  <span className="truncate">{order.buyer.full_name}</span>
                </div>
              )}
              {(order.buyer?.phone ?? order.supermarkets?.contact_phone) && (
                <div className="flex items-center gap-1.5">
                  <Phone
                    className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                    strokeWidth={2.2}
                  />
                  <a
                    href={`tel:${(order.buyer?.phone ?? order.supermarkets?.contact_phone ?? "").replace(/\s/g, "")}`}
                    className="font-mono text-[12px] hover:text-primary"
                  >
                    {order.buyer?.phone ?? order.supermarkets?.contact_phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Line items as a table */}
          <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h2 className="text-[15px] font-bold tracking-tight">Бараа</h2>
              <span className="text-[11px] text-muted-foreground">
                {order.order_items.length} ширхэг
              </span>
            </div>
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2.5">Бараа</th>
                  <th className="text-right px-3 py-2.5 w-16">Тоо</th>
                  <th className="text-right px-3 py-2.5 w-28">Үнэ</th>
                  <th className="text-right px-5 py-2.5 w-32">Дүн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.order_items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">
                      <div className="text-[12.5px] font-semibold leading-snug">
                        {item.product_name_snapshot}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.qty}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatMnt(item.unit_price)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums">
                      {formatMnt(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40">
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-2 text-right text-[12px] text-muted-foreground"
                  >
                    Дэд дүн
                  </td>
                  <td className="px-5 py-2 text-right text-[13px] tabular-nums text-muted-foreground">
                    {formatMnt(order.subtotal)}
                  </td>
                </tr>
                {order.discount_total && order.discount_total > 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-2 text-right text-[12px] text-emerald-700 dark:text-emerald-400"
                    >
                      Хямдрал
                      {order.payment_method === "cash" && " · Бэлэн 2%"}
                    </td>
                    <td className="px-5 py-2 text-right text-[13px] tabular-nums text-emerald-700 dark:text-emerald-400">
                      −{formatMnt(order.discount_total)}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-3 text-right text-[12.5px] font-semibold"
                  >
                    Нийт төлөх
                    {order.payment_method && (
                      <span
                        className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ring-1 ${
                          order.payment_method === "cash"
                            ? "bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60"
                            : "bg-muted text-muted-foreground ring-border"
                        }`}
                      >
                        {order.payment_method === "cash" ? "Бэлэн" : "Зээл"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-[15px] font-bold tabular-nums">
                    {formatMnt(
                      order.subtotal - (order.discount_total ?? 0),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

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
              value={
                order.buyer?.full_name ??
                order.buyer?.phone ??
                "—"
              }
            />
            {order.buyer?.full_name && order.buyer.phone && (
              <FactRow label="Утас" value={order.buyer.phone} mono />
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
