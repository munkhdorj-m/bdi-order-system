import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Check, Gift, Store as StoreIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { OrderProgress } from "@/components/order-progress";
import { RepHeader } from "@/components/rep/rep-header";
import { OrderEditControls } from "@/components/buyer/order-edit-controls";
import { getSession } from "@/lib/auth";
import { type OrderStatus } from "@/lib/order-status";
import { formatMnt } from "@/lib/format";
import { formatDeliveryDay } from "@/lib/delivery";

type Params = Promise<{ id: string }>;
type Search = Promise<{ new?: string }>;

type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  placed_by: string | null;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  /** Planned delivery day ("YYYY-MM-DD"), set when the office schedules it. */
  delivery_date: string | null;
  supermarkets: { id: string; name: string } | null;
  order_items: {
    id: string;
    product_id: string;
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

export default async function RepOrderDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Arrived straight from "send" in the cart.
  const justSent = sp.new === "1";
  const supabase = await createClient();

  const [{ data }, session] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_number, status, subtotal, discount_total, placed_by, notes, created_at, confirmed_at, shipped_at, delivered_at, delivery_date,
         supermarkets:supermarket_id(id, name),
         order_items(id, product_id, product_name_snapshot, qty, unit_price, line_total)`,
      )
      .eq("id", id)
      .single(),
    getSession(), // cached — the layout already loaded it
  ]);

  if (!data) notFound();
  const order = data as unknown as OrderDetail;
  // The rep can fix an order they entered until the office confirms it.
  const canEdit = order.status === "pending" && !!session && order.placed_by === session.userId;

  const storeHref = order.supermarkets ? `/rep/stores/${order.supermarkets.id}` : "/rep";
  const discount = order.discount_total ?? 0;
  const net = order.subtotal - discount;
  const pieces = order.order_items.reduce((n, i) => n + i.qty, 0);
  const plannedDay =
    order.delivery_date && order.status !== "cancelled" && order.status !== "delivered"
      ? formatDeliveryDay(order.delivery_date)
      : null;

  return (
    <div>
      <RepHeader
        title={order.order_number}
        subtitle={order.supermarkets?.name}
        backHref={justSent ? "/rep" : storeHref}
      />

      <main className="mx-auto max-w-2xl px-3 py-4 sm:px-4">
        {justSent && (
          <div className="mb-4 rounded-3xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Check className="h-7 w-7" strokeWidth={3} />
            </div>
            <h1 className="text-[20px] font-semibold">Захиалга илгээгдлээ</h1>
            <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-muted-foreground">
              {order.supermarkets?.name} · {formatMnt(net)}. BDI баталгаажуулахад төлөв энд шинэчлэгдэнэ.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg">
                <Link href="/rep">
                  <StoreIcon className="size-4" />
                  Дараагийн дэлгүүр
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={storeHref}>Энэ дэлгүүр рүү</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mb-1 flex flex-wrap items-center gap-2">
          <OrderStatusPill status={order.status} size="md" />
          {plannedDay && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[13px] font-semibold text-primary">
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.2} />
              Хүргэх: {plannedDay}
            </span>
          )}
        </div>
        <p className="mb-4 text-[13px] text-muted-foreground">{formatDateTime(order.created_at)}</p>

        <Card className="mb-4">
          <CardContent className="pb-5 pt-6">
            <OrderProgress
              status={order.status}
              timestamps={{
                pending: order.created_at,
                confirmed: order.confirmed_at,
                shipped: order.shipped_at,
                delivered: order.delivered_at,
              }}
            />
          </CardContent>
        </Card>

        {canEdit && (
          <div className="mb-4">
            <p className="mb-2 px-1 text-[12.5px] text-muted-foreground">
              Баталгаажаагүй байна — тоог засах, бараа хасах, цуцлах боломжтой.
            </p>
            <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-card">
              <OrderEditControls orderId={order.id} orderNumber={order.order_number} items={order.order_items} />
            </div>
          </div>
        )}

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">
              Бараа · {order.order_items.length} төрөл · {pieces} ширхэг
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {order.order_items.map((item) => {
                const gift = Number(item.unit_price) === 0;
                return (
                  <div key={item.id} className="flex justify-between gap-3 px-4 py-3 even:bg-muted/40 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm leading-tight">{item.product_name_snapshot}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {gift ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                            <Gift className="h-3.5 w-3.5" /> Бэлэг · {item.qty}ш
                          </span>
                        ) : (
                          <>
                            {formatMnt(item.unit_price)} × {item.qty}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-medium tabular-nums">
                      {gift ? "0₮" : formatMnt(item.line_total)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1 border-t border-border px-4 py-3 sm:px-6">
              {discount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Дүн</span>
                    <span className="tabular-nums">{formatMnt(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-400">
                    <span>Хямдрал</span>
                    <span className="tabular-nums">−{formatMnt(discount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold">
                <span>Нийт төлөх</span>
                <span className="font-display tabular-nums">{formatMnt(net)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {order.notes && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Тэмдэглэл</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{order.notes}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
