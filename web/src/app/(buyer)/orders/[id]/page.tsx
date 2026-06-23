import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { OrderEditControls } from "@/components/buyer/order-edit-controls";
import { OrderTimeline } from "@/components/buyer/order-timeline";
import { ReorderButton } from "@/components/buyer/reorder-button";
import { formatMnt } from "@/lib/format";
import { type OrderStatus } from "@/lib/order-status";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ new?: string }>;

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
    // Always render in Mongolia time — server renders in UTC otherwise.
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function etaLine(o: OrderDetail): string {
  switch (o.status) {
    case "pending":
      return "Баталгаажуулахыг хүлээж байна";
    case "confirmed":
      return "Багцлагдаж байна";
    case "shipped":
      return "Хүргэлтэнд гарсан";
    case "delivered":
      return o.delivered_at
        ? `${formatDateTime(o.delivered_at)} хүргэгдсэн`
        : "Хүргэгдсэн";
    case "cancelled":
      return "Цуцлагдсан";
  }
}

// Public BDI support phone. Set NEXT_PUBLIC_BDI_SUPPORT_PHONE in your env
// to override; falls back to a placeholder so the tel: link is always live.
const BDI_PHONE =
  process.env.NEXT_PUBLIC_BDI_SUPPORT_PHONE ?? "+976 7000 0000";

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
      "id, order_number, status, subtotal, discount_total, payment_method, notes, created_at, confirmed_at, shipped_at, delivered_at, order_items(id, product_id, product_name_snapshot, qty, unit_price, line_total)",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const order = data as unknown as OrderDetail;

  const reorderLines = order.order_items.map((li) => ({
    product_id: li.product_id,
    product_name_snapshot: li.product_name_snapshot,
    qty: li.qty,
    unit_price: li.unit_price,
  }));

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto pb-28">
      {/* Celebratory "just placed" hero — only shows once from the cart
          submit redirect (?new=1). Includes confetti backdrop + check medal
          + order-summary card per Hi-Fi BuyerOrderPlaced. */}
      {isNew && <OrderPlacedHero order={order} />}

      {/* Order number row */}
      <div className="mb-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
          Захиалга
        </span>
        <h1 className="text-[20px] font-bold tracking-tight font-mono">
          {order.order_number}
        </h1>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatDateTime(order.created_at)}
        </span>
      </div>

      {/* Status hero card — brand-tinted background, status pill + total + ETA */}
      <div className="rounded-3xl ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] bg-[color-mix(in_oklch,var(--primary)_5%,var(--card))] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
              Статус
            </div>
            <div className="mt-1">
              <OrderStatusPill status={order.status} size="md" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
              Нийт
            </div>
            <div className="text-[18px] font-bold tabular-nums">
              {formatMnt(order.subtotal)}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12.5px]">
          <Truck className="h-3.5 w-3.5 text-foreground/70" strokeWidth={2.2} />
          <span className="text-foreground/80">{etaLine(order)}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-5 px-1">
        <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-3">
          Явц
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
      </div>

      {/* Line items */}
      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-2 flex items-center justify-between px-1">
          <span>Бараа · {order.order_items.length}</span>
        </div>

        {order.status === "pending" ? (
          // Pending orders keep the inline edit controls (qty +/-, cancel)
          // wrapped in the same card chrome the rest of the page uses.
          <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
            <OrderEditControls
              orderId={order.id}
              orderNumber={order.order_number}
              items={order.order_items}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {order.order_items.map((line) => (
              <div
                key={line.id}
                className="flex gap-3 p-3 rounded-2xl bg-card ring-1 ring-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold leading-snug">
                    {line.product_name_snapshot}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11.5px] text-muted-foreground tabular-nums">
                    <span>
                      {formatMnt(line.unit_price)} × {line.qty}
                    </span>
                    <span className="font-bold text-foreground">
                      {formatMnt(line.line_total)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subtotal + discount + net rows, only on non-pending orders
            (pending orders show the breakdown inside the edit-controls
            component). The cash 2% discount surfaces here so the buyer
            can confirm what they'll actually pay. */}
        {order.status !== "pending" && (
          <div className="mt-2 rounded-2xl bg-muted/40 px-3 py-2.5 space-y-1">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground tabular-nums">
              <span>Дэд дүн</span>
              <span>{formatMnt(order.subtotal)}</span>
            </div>
            {order.discount_total && order.discount_total > 0 ? (
              <div className="flex items-center justify-between text-[12px] tabular-nums text-emerald-700 dark:text-emerald-400">
                <span>
                  Хямдрал
                  {order.payment_method === "cash" && " · Бэлэн 2%"}
                </span>
                <span>−{formatMnt(order.discount_total)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[13px] font-bold tabular-nums">
              <span className="flex items-center gap-1.5">
                Нийт төлөх
                {order.payment_method && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-bold ring-1 ${
                      order.payment_method === "cash"
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60"
                        : "bg-muted text-muted-foreground ring-border"
                    }`}
                  >
                    {order.payment_method === "cash" ? "Бэлэн" : "Зээл"}
                  </span>
                )}
              </span>
              <span>
                {formatMnt(order.subtotal - (order.discount_total ?? 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Note */}
      {order.notes && (
        <div className="mt-4 rounded-2xl bg-muted/60 ring-1 ring-border p-3">
          <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-1.5">
            Тэмдэглэл
          </div>
          <p className="text-[12.5px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
            {order.notes}
          </p>
        </div>
      )}

      {/* Sticky bottom CTAs — phone support + reorder. Reorder works on
          every status (delivered/cancelled/in-flight); buyers occasionally
          want to top up an in-flight order with a copy. */}
      <div
        className="fixed left-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur px-3 pt-3"
        style={{
          bottom: "calc(3.5rem + env(safe-area-inset-bottom))",
          paddingBottom: "12px",
        }}
      >
        <div className="max-w-2xl mx-auto flex gap-2">
          <a
            href={`tel:${BDI_PHONE.replace(/\s/g, "")}`}
            className="flex-1 h-11 rounded-2xl text-[13px] font-semibold border border-border bg-card hover:bg-muted active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <Phone className="h-4 w-4" />
            BDI-д залгах
          </a>
          <ReorderButton lines={reorderLines} />
        </div>
      </div>
    </div>
  );
}

function OrderPlacedHero({ order }: { order: OrderDetail }) {
  return (
    <div className="relative mb-5 rounded-3xl overflow-hidden ring-1 ring-border bg-card shadow-md shadow-black/5 animate-fade-in-scale">
      {/* Brand-tinted radial wash backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 25%, transparent) 0%, transparent 50%), radial-gradient(circle at 70% 70%, color-mix(in oklch, #10b981 25%, transparent) 0%, transparent 50%)",
        }}
      />
      <div className="relative flex flex-col items-center px-6 pt-7 pb-6">
        <div
          className="size-20 rounded-full flex items-center justify-center text-white shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.7 0.16 155), oklch(0.55 0.16 155))",
            boxShadow:
              "0 16px 40px -10px color-mix(in oklch, #10b981 50%, transparent)",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h2 className="mt-5 text-[22px] font-bold tracking-tight">
          Захиалга илгээгдлээ!
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground text-center max-w-[270px] leading-relaxed">
          BDI таны захиалгыг хүлээж авлаа. Удахгүй холбогдох болно.
        </p>

        <div className="mt-5 w-full rounded-2xl bg-card ring-1 ring-border px-4 py-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                Бараа
              </div>
              <div className="text-[14px] font-bold tabular-nums">
                {order.order_items.length}
              </div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                Нийт
              </div>
              <div className="text-[14px] font-bold tabular-nums">
                {formatMnt(order.subtotal)}
              </div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                Дугаар
              </div>
              <div className="text-[12px] font-bold font-mono tracking-tight truncate">
                {order.order_number.replace(/^ORD-\d{4}-/, "")}
              </div>
            </div>
          </div>
        </div>

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-3 text-muted-foreground"
        >
          <Link href="/catalog">← Каталог руу буцах</Link>
        </Button>
      </div>
    </div>
  );
}
