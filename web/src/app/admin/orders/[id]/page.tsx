import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { OrderActions } from "@/components/admin/order-actions";
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
  supermarkets: {
    name: string;
    address: string | null;
    contact_phone: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  } | null;
  buyer: {
    full_name: string | null;
    email: string | null;
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      `id, order_number, status, subtotal, notes, created_at, confirmed_at, delivered_at,
       supermarkets:supermarket_id(name, address, contact_phone, profiles:assigned_rep_id(full_name, email)),
       buyer:placed_by(full_name, email, phone),
       order_items(id, product_name_snapshot, qty, unit_price, line_total)`,
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const order = data as unknown as OrderDetail;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/orders"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Захиалга жагсаалт руу
      </Link>

      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-semibold font-mono tracking-tight">
          {order.order_number}
        </h1>
        <OrderStatusPill status={order.status} />
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {formatDateTime(order.created_at)}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Дэлгүүр</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">{order.supermarkets?.name ?? "—"}</div>
            {order.supermarkets?.address && (
              <div className="text-muted-foreground">
                {order.supermarkets.address}
              </div>
            )}
            {order.supermarkets?.contact_phone && (
              <div className="text-muted-foreground">
                {order.supermarkets.contact_phone}
              </div>
            )}
            {order.supermarkets?.profiles?.full_name && (
              <div className="text-xs text-muted-foreground pt-1">
                Хариуцагч: {order.supermarkets.profiles.full_name}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Захиалсан</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">
              {order.buyer?.full_name ?? order.buyer?.email ?? "—"}
            </div>
            {order.buyer?.email && (
              <div className="text-muted-foreground font-mono text-xs">
                {order.buyer.email}
              </div>
            )}
            {order.buyer?.phone && (
              <div className="text-muted-foreground font-mono text-xs">
                {order.buyer.phone}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
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
        <Card className="mb-6">
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Төлвийн түүх</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <TimelineRow label="Үүсгэсэн" at={order.created_at} />
          {order.confirmed_at && (
            <TimelineRow label="Баталгаажсан" at={order.confirmed_at} />
          )}
          {order.delivered_at && (
            <TimelineRow label="Хүргэгдсэн" at={order.delivered_at} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Үйлдэл</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderActions orderId={order.id} status={order.status} />
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineRow({ label, at }: { label: string; at: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-muted-foreground text-xs">{formatDateTime(at)}</span>
    </div>
  );
}
