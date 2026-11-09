import Link from "next/link";
import { CalendarDays, Check, ClipboardList, Clock, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { formatMnt } from "@/lib/format";
import { formatDeliveryDay } from "@/lib/delivery";
import { todayUb, ubDayOf } from "@/lib/dispatch";
import {
  ACTIVE_STATUSES,
  STATUS_STEPS,
  isFinal,
  statusStepIndex,
  type OrderStatus,
} from "@/lib/order-status";
import { formatDayMonthTime } from "@/lib/datetime";

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivery_date: string | null;
  /** Supabase aggregate join — array with one {count} entry. */
  order_items: Array<{ count: number }>;
};

type FilterKey = "active" | "delivered" | "all";

type SearchParams = Promise<{ status?: string; n?: string }>;

/** Orders per page; "Цааш үзэх" shows this many more. */
const PAGE = 20;
const MAX_ROWS = 300;

function parseFilter(v: string | undefined): FilterKey {
  return v === "delivered" || v === "all" ? v : "active";
}

// "11.08 13:05" (mn-MN Intl would print "XI/08").
function formatShortDateTime(iso: string) {
  return formatDayMonthTime(iso);
}

/** "өнөөдөр" / "өчигдөр" / "5 өдрийн өмнө" — counted in Ulaanbaatar days. */
function relativeDay(iso: string): string {
  const day = ubDayOf(iso);
  const diff = Math.round(
    (Date.parse(`${todayUb()}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000,
  );
  if (diff <= 0) return "өнөөдөр";
  if (diff === 1) return "өчигдөр";
  if (diff < 30) return `${diff} өдрийн өмнө`;
  return day;
}

/**
 * Pick the right "where are we" line for each status. Falls back to the
 * order date for cancelled or pre-confirmation orders.
 */
function etaLine(o: OrderRow): string {
  switch (o.status) {
    case "pending":
      return "BDI баталгаажуулахыг хүлээж байна";
    case "confirmed":
      return o.confirmed_at ? `${relativeDay(o.confirmed_at)} баталгаажсан` : "Баталгаажсан";
    case "shipped":
      return o.shipped_at ? `${relativeDay(o.shipped_at)} илгээгдсэн` : "Хүргэлтэнд гарсан";
    case "delivered":
      return o.delivered_at ? `${relativeDay(o.delivered_at)} хүргэгдсэн` : "Хүргэгдсэн";
    case "cancelled":
      return "Захиалга цуцлагдсан";
  }
}

function ProgressBar({ status }: { status: OrderStatus }) {
  // For cancelled orders, no step is lit.
  const step = status === "cancelled" ? -1 : statusStepIndex(status);
  return (
    <div className="flex gap-1 mt-3" aria-hidden="true">
      {STATUS_STEPS.map((_, i) => (
        <div
          key={i}
          className="flex-1 h-1 rounded-full"
          style={{
            background:
              i <= step
                ? "var(--primary)"
                : "color-mix(in oklch, var(--primary) 14%, var(--muted))",
          }}
        />
      ))}
    </div>
  );
}

function OrderCard({ o }: { o: OrderRow }) {
  const items = o.order_items?.[0]?.count ?? 0;
  const StatusIcon = isFinal(o.status) ? Check : Clock;
  const net = (Number(o.subtotal) || 0) - (Number(o.discount_total) || 0);
  const planned = o.delivery_date && ACTIVE_STATUSES.includes(o.status) ? o.delivery_date : null;

  return (
    <Link
      href={`/orders/${o.id}`}
      className="block rounded-3xl bg-card ring-1 ring-border overflow-hidden hover:shadow-md hover:shadow-[color-mix(in_oklch,var(--primary)_15%,transparent)] hover:ring-[color-mix(in_oklch,var(--primary)_30%,transparent)] transition-all"
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-muted-foreground">Захиалга</div>
            <div className="text-[15px] font-bold tracking-tight font-mono">{o.order_number}</div>
          </div>
          <OrderStatusPill status={o.status} />
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            {formatShortDateTime(o.created_at)} · {items} бараа
          </span>
          <span className="font-display text-[16px] font-semibold text-foreground tabular-nums">
            {formatMnt(net)}
          </span>
        </div>

        <ProgressBar status={o.status} />

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
            {etaLine(o)}
          </span>
          {planned && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.2} />
              Хүргэх: {formatDeliveryDay(planned)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function BuyerOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filter = parseFilter(sp.status);
  const limit = Math.min(MAX_ROWS, Math.max(PAGE, Math.floor(Number(sp.n) || PAGE)));

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, discount_total, created_at, confirmed_at, shipped_at, delivered_at, delivery_date, order_items(count)",
    )
    .order("created_at", { ascending: false })
    // One extra row tells whether there's more to show.
    .range(0, limit);

  if (filter === "active") {
    query = query.in("status", ACTIVE_STATUSES);
  } else if (filter === "delivered") {
    query = query.eq("status", "delivered");
  }

  // The list and the "Идэвхтэй" badge count in one round trip.
  const [{ data }, { count }] = await Promise.all([
    query,
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_STATUSES),
  ]);
  const all = (data as unknown as OrderRow[]) ?? [];
  const hasMore = all.length > limit;
  const rows = hasMore ? all.slice(0, limit) : all;
  const activeCount = count ?? 0;

  const tabs: { key: FilterKey; label: string; badge?: number }[] = [
    { key: "active", label: "Идэвхтэй", badge: activeCount || undefined },
    { key: "delivered", label: "Хүргэгдсэн" },
    { key: "all", label: "Бүгд" },
  ];

  const hrefFor = (key: FilterKey, n?: number) => {
    const params = new URLSearchParams();
    if (key !== "active") params.set("status", key);
    if (n) params.set("n", String(n));
    const qs = params.toString();
    return qs ? `/orders?${qs}` : "/orders";
  };

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
      <h1 className="text-[22px] font-bold tracking-tight">Захиалгууд</h1>

      {/* Filter tabs — URL-driven so the state survives reloads and
          back/forward navigation. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.key === filter;
          return (
            <Link
              key={t.key}
              href={hrefFor(t.key)}
              className="chip h-10"
              data-active={active || undefined}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
              {t.badge != null && (
                <span className={`tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-[14px] text-muted-foreground">
            {filter === "active" ? "Идэвхтэй захиалга алга байна." : "Захиалга алга байна."}
          </p>
          {/* Dead-ends frustrate — always offer the obvious next step. */}
          <Button asChild variant="gold" size="lg" className="mt-5">
            <Link href="/catalog">
              <ShoppingBag className="size-4" />
              Захиалга өгөх
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {rows.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
          {hasMore && (
            <Button asChild variant="outline" size="lg" className="mt-1">
              <Link href={hrefFor(filter, limit + PAGE)} scroll={false}>
                Цааш үзэх
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
