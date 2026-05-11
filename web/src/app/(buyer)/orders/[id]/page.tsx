import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMnt } from "@/lib/format";

type Params = Promise<{ id: string }>;

type OrderStatus =
  | "pending"
  | "confirmed"
  | "packing"
  | "shipped"
  | "delivered"
  | "cancelled";

type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  order_items: {
    id: string;
    product_name_snapshot: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }[];
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Хүлээгдэж буй",
  confirmed: "Баталгаажсан",
  packing: "Багцлаж буй",
  shipped: "Илгээсэн",
  delivered: "Хүргэгдсэн",
  cancelled: "Цуцлагдсан",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  packing: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  shipped: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  delivered:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
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
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, notes, created_at, confirmed_at, delivered_at, order_items(id, product_name_snapshot, qty, unit_price, line_total)",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const order = data as unknown as OrderDetail;

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="text-xl font-semibold font-mono">
            {order.order_number}
          </h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status]}`}
          >
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDateTime(order.created_at)}
        </div>
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

      <div className="bg-background border rounded-lg p-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Төлвийн түүх
        </div>
        <div className="space-y-1.5 text-sm">
          <TimelineRow label="Үүсгэсэн" at={order.created_at} />
          {order.confirmed_at && (
            <TimelineRow label="Баталгаажсан" at={order.confirmed_at} />
          )}
          {order.delivered_at && (
            <TimelineRow label="Хүргэгдсэн" at={order.delivered_at} />
          )}
        </div>
      </div>
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
