import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { type OrderStatus } from "@/lib/order-status";
import { formatMnt } from "@/lib/format";

type Params = Promise<{ id: string }>;

type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  supermarkets: { id: string; name: string } | null;
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RepOrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, subtotal, notes, created_at, confirmed_at, delivered_at,
       supermarkets:supermarket_id(id, name),
       order_items(id, product_name_snapshot, qty, unit_price, line_total)`,
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const order = data as unknown as OrderDetail;

  const backHref = order.supermarkets
    ? `/rep/stores/${order.supermarkets.id}`
    : "/rep";

  return (
    <div>
      <header className="sticky top-0 z-10 h-14 border-b bg-background flex items-center px-3 sm:px-4">
        <Link href={backHref} className="-ml-2 mr-1 p-2 rounded-md hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate font-mono">
            {order.order_number}
          </div>
          {order.supermarkets && (
            <div className="text-[11px] text-muted-foreground leading-tight truncate">
              {order.supermarkets.name}
            </div>
          )}
        </div>
      </header>

      <main className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <OrderStatusPill status={order.status} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {formatDateTime(order.created_at)}
        </p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">Барааны жагсаалт</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {order.order_items.map((item) => (
                <div
                  key={item.id}
                  className="px-6 py-3 flex justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-tight">
                      {item.product_name_snapshot}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatMnt(item.unit_price)} × {item.qty}
                    </div>
                  </div>
                  <div className="text-sm font-medium shrink-0">
                    {formatMnt(item.line_total)}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-3 border-t flex justify-between font-semibold">
              <span>Нийт</span>
              <span>{formatMnt(order.subtotal)}</span>
            </div>
          </CardContent>
        </Card>

        {order.notes && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Тэмдэглэл</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {order.notes}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Төлвийн түүх</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Үүсгэсэн" at={order.created_at} />
            {order.confirmed_at && (
              <Row label="Баталгаажсан" at={order.confirmed_at} />
            )}
            {order.delivered_at && (
              <Row label="Хүргэгдсэн" at={order.delivered_at} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, at }: { label: string; at: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-muted-foreground text-xs">{formatDateTime(at)}</span>
    </div>
  );
}
