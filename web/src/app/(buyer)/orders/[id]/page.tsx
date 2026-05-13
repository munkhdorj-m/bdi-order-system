import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { OrderProgress } from "@/components/order-progress";
import { formatMnt } from "@/lib/format";
import { type OrderStatus } from "@/lib/order-status";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ new?: string }>;

type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
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

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, notes, created_at, confirmed_at, shipped_at, delivered_at, order_items(id, product_name_snapshot, qty, unit_price, line_total)",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const order = data as unknown as OrderDetail;

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
      {isNew && (
        <div className="mb-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold mb-1">
            Захиалга илгээгдлээ!
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            BDI таны захиалгыг хүлээж авлаа. Удахгүй холбогдоно.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/catalog">Каталог руу буцах</Link>
          </Button>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="text-xl font-semibold font-mono">
            {order.order_number}
          </h1>
          <OrderStatusPill status={order.status} size="md" />
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDateTime(order.created_at)}
        </div>
      </div>

      <div className="bg-background border rounded-xl p-4 mb-4">
        <OrderProgress
          status={order.status}
          timestamps={{
            pending: order.created_at,
            confirmed: order.confirmed_at,
            shipped: order.shipped_at,
            delivered: order.delivered_at,
          }}
        />
      </div>

      <div className="bg-background border rounded-lg overflow-hidden mb-4">
        <div className="px-4 py-3 border-b text-sm font-medium">
          Барааны жагсаалт
        </div>
        <div className="divide-y">
          {order.order_items.map((item) => (
            <div key={item.id} className="px-4 py-3 flex justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-tight">
                  {item.product_name_snapshot}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatMnt(item.unit_price)} × {item.qty}
                </div>
              </div>
              <div className="text-sm font-medium shrink-0">
                {formatMnt(item.line_total)}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t flex justify-between font-semibold">
          <span>Нийт</span>
          <span>{formatMnt(order.subtotal)}</span>
        </div>
      </div>

      {order.notes && (
        <div className="bg-background border rounded-lg p-4 mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Тэмдэглэл
          </div>
          <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
