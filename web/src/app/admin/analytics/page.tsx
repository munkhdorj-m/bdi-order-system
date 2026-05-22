import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Coins,
  Package,
  ShoppingCart,
  Store as StoreIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatMnt } from "@/lib/format";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import {
  STATUS_LABELS,
  STATUS_SOLID,
  type OrderStatus,
} from "@/lib/order-status";

// =====================================================================
// /admin/analytics
// One-screen overview of how the business has moved over the last 30
// days, with a same-length comparison window (the previous 30 days) so
// the deltas on the stat cards are honest.
//
// Every query runs in parallel via Promise.all so the page hydrates in a
// single round-trip. The bar chart is a static SVG built from a 30-row
// aggregate — no client JS needed.
// =====================================================================

type AggOrder = {
  id: string;
  status: OrderStatus;
  subtotal: number;
  created_at: string;
  supermarket_id: string | null;
};

type OrderItemAgg = {
  product_id: string;
  qty: number;
  line_total: number;
  product_name_snapshot: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function deltaPct(now: number, prev: number): number | null {
  if (prev === 0) {
    if (now === 0) return 0;
    return null; // brand new — no comparable baseline
  }
  return Math.round(((now - prev) / prev) * 100);
}

function formatDelta(d: number | null): string {
  if (d === null) return "Шинэ";
  if (d > 0) return `+${d}%`;
  return `${d}%`;
}

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: typeof BarChart3;
  tone: "primary" | "emerald" | "violet" | "sky";
}) {
  const TONE: Record<string, string> = {
    primary:
      "bg-[color-mix(in_oklch,var(--primary)_15%,var(--card))] text-primary",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  };
  const positive = delta !== null && delta > 0;
  const negative = delta !== null && delta < 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`size-9 rounded-xl flex items-center justify-center ${TONE[tone]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              positive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : negative
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : negative ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : null}
            {formatDelta(delta)}
          </span>
        </div>
        <div className="mt-3 text-[24px] font-bold tabular-nums tracking-tight leading-none">
          {value}
        </div>
        <div className="text-[12.5px] text-muted-foreground mt-1.5">
          {label}
        </div>
        <div className="text-[10.5px] text-muted-foreground/70 mt-0.5">
          сүүлийн 30 хоног
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const now = new Date();
  const today = startOfDay(now);
  const windowDays = 30;
  const startCurrent = new Date(today.getTime() - (windowDays - 1) * DAY_MS); // inclusive
  const startPrevious = new Date(today.getTime() - (2 * windowDays - 1) * DAY_MS);
  const endPreviousExclusive = startCurrent;

  const currentStartIso = startCurrent.toISOString();
  const previousStartIso = startPrevious.toISOString();
  const previousEndIso = endPreviousExclusive.toISOString();

  // Pull current-window orders WITH supermarket name (for the top-stores
  // ranking and status breakdown) and previous-window orders without joins
  // (we only need totals/counts for deltas).
  const [
    { data: currentOrders, error: currErr },
    { data: previousOrders, error: prevErr },
    { data: stores },
    { data: orderItemsRaw },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, subtotal, created_at, supermarket_id")
      .gte("created_at", currentStartIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, status, subtotal, created_at, supermarket_id")
      .gte("created_at", previousStartIso)
      .lt("created_at", previousEndIso),
    supabase.from("supermarkets").select("id, name"),
    // order_items joined to orders for time-window filtering. Supabase lets
    // us filter on the parent table with `orders.created_at`.
    supabase
      .from("order_items")
      .select(
        "product_id, qty, line_total, product_name_snapshot, orders!inner(created_at, status)",
      )
      .gte("orders.created_at", currentStartIso)
      .neq("orders.status", "cancelled"),
  ]);

  const errorMsg = currErr?.message ?? prevErr?.message ?? null;
  const current = (currentOrders as unknown as AggOrder[]) ?? [];
  const previous = (previousOrders as unknown as AggOrder[]) ?? [];
  const storeById = new Map<string, string>();
  for (const s of (stores as { id: string; name: string }[] | null) ?? []) {
    storeById.set(s.id, s.name);
  }

  // Strip out cancelled orders for revenue & average calculations — they
  // still count for the "total orders" stat but they aren't real revenue.
  const currentRealised = current.filter((o) => o.status !== "cancelled");
  const previousRealised = previous.filter((o) => o.status !== "cancelled");

  const revenueNow = currentRealised.reduce(
    (a, o) => a + Number(o.subtotal ?? 0),
    0,
  );
  const revenuePrev = previousRealised.reduce(
    (a, o) => a + Number(o.subtotal ?? 0),
    0,
  );
  const ordersNow = current.length;
  const ordersPrev = previous.length;
  const avgNow = currentRealised.length
    ? Math.round(revenueNow / currentRealised.length)
    : 0;
  const avgPrev = previousRealised.length
    ? Math.round(revenuePrev / previousRealised.length)
    : 0;

  const activeStoresNow = new Set(
    currentRealised.map((o) => o.supermarket_id).filter(Boolean),
  ).size;
  const activeStoresPrev = new Set(
    previousRealised.map((o) => o.supermarket_id).filter(Boolean),
  ).size;

  // -------------------------------------------------------------------
  // 30-day revenue trend buckets (oldest → newest).
  // -------------------------------------------------------------------
  type Bucket = { date: Date; key: string; revenue: number; orders: number };
  const buckets: Bucket[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(startCurrent.getTime() + i * DAY_MS);
    buckets.push({
      date: d,
      key: d.toISOString().slice(0, 10),
      revenue: 0,
      orders: 0,
    });
  }
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
  for (const o of currentRealised) {
    const k = o.created_at.slice(0, 10);
    const b = bucketByKey.get(k);
    if (b) {
      b.revenue += Number(o.subtotal ?? 0);
      b.orders += 1;
    }
  }
  const maxRev = Math.max(1, ...buckets.map((b) => b.revenue));

  // -------------------------------------------------------------------
  // Status breakdown (current window)
  // -------------------------------------------------------------------
  const statusCounts: Record<OrderStatus, number> = {
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const o of current) statusCounts[o.status] += 1;
  const statusTotal = current.length || 1;

  // -------------------------------------------------------------------
  // Top stores by revenue (current window, excluding cancelled)
  // -------------------------------------------------------------------
  const storeAgg = new Map<
    string,
    { name: string; revenue: number; orders: number }
  >();
  for (const o of currentRealised) {
    if (!o.supermarket_id) continue;
    const name = storeById.get(o.supermarket_id) ?? "Үл мэдэгдэх";
    const row = storeAgg.get(o.supermarket_id) ?? {
      name,
      revenue: 0,
      orders: 0,
    };
    row.revenue += Number(o.subtotal ?? 0);
    row.orders += 1;
    storeAgg.set(o.supermarket_id, row);
  }
  const topStores = Array.from(storeAgg.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // -------------------------------------------------------------------
  // Top products by units (current window)
  // -------------------------------------------------------------------
  const items =
    (orderItemsRaw as unknown as OrderItemAgg[] | null)?.filter(
      (r) => r && r.product_id,
    ) ?? [];
  const productAgg = new Map<
    string,
    { name: string; units: number; revenue: number }
  >();
  for (const it of items) {
    const row = productAgg.get(it.product_id) ?? {
      name: it.product_name_snapshot,
      units: 0,
      revenue: 0,
    };
    row.units += Number(it.qty ?? 0);
    row.revenue += Number(it.line_total ?? 0);
    productAgg.set(it.product_id, row);
  }
  const topProducts = Array.from(productAgg.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

  const fmtDay = (d: Date) =>
    d.toLocaleDateString("mn-MN", { month: "2-digit", day: "2-digit" });

  return (
    <div className="max-w-6xl">
      <div className="mb-5">
        <h1 className="text-[26px] font-bold tracking-tight">Аналитик</h1>
        <p className="text-[13px] text-muted-foreground">
          {fmtDay(startCurrent)} – {fmtDay(today)} · сүүлийн {windowDays} хоног
        </p>
      </div>

      {errorMsg && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {errorMsg}
        </Card>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Орлого"
          value={formatMnt(revenueNow)}
          delta={deltaPct(revenueNow, revenuePrev)}
          icon={Coins}
          tone="emerald"
        />
        <StatCard
          label="Захиалга"
          value={ordersNow.toLocaleString("mn-MN")}
          delta={deltaPct(ordersNow, ordersPrev)}
          icon={ShoppingCart}
          tone="primary"
        />
        <StatCard
          label="Дундаж захиалга"
          value={formatMnt(avgNow)}
          delta={deltaPct(avgNow, avgPrev)}
          icon={BarChart3}
          tone="violet"
        />
        <StatCard
          label="Идэвхтэй дэлгүүр"
          value={activeStoresNow.toLocaleString("mn-MN")}
          delta={deltaPct(activeStoresNow, activeStoresPrev)}
          icon={StoreIcon}
          tone="sky"
        />
      </div>

      {/* Revenue trend chart */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">
                Орлогын чиг
              </h2>
              <p className="text-[12px] text-muted-foreground">
                Өдөр тутмын борлуулалт (цуцлагдсанаас бусад)
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              Хамгийн дээд: {formatMnt(maxRev)}
            </div>
          </div>

          {/* Bar chart — pure CSS height with tabular labels under each bar.
              We highlight the latest 7 days in primary tint so today's pace
              is obvious at a glance. */}
          <div className="flex items-end gap-[3px] h-40">
            {buckets.map((b, i) => {
              const h = (b.revenue / maxRev) * 100;
              const recent = i >= windowDays - 7;
              return (
                <div
                  key={b.key}
                  className="flex-1 min-w-0 h-full flex flex-col justify-end group relative"
                  title={`${b.key} · ${formatMnt(b.revenue)} · ${b.orders} захиалга`}
                >
                  <div
                    style={{ height: `${Math.max(2, h)}%` }}
                    className={`w-full rounded-t-md transition-all ${
                      recent
                        ? "bg-primary group-hover:opacity-90"
                        : "bg-primary/30 group-hover:bg-primary/50"
                    }`}
                  />
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-popover text-popover-foreground text-[10.5px] font-medium shadow-md ring-1 ring-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    <div className="font-mono">{b.key}</div>
                    <div className="tabular-nums">{formatMnt(b.revenue)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* X-axis ticks: only the start, midpoint, and end labels to keep
              it readable on narrow screens. */}
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{fmtDay(buckets[0].date)}</span>
            <span>
              {fmtDay(buckets[Math.floor(windowDays / 2)].date)}
            </span>
            <span>{fmtDay(buckets[buckets.length - 1].date)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top products */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3.5 border-b flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[14px] font-bold tracking-tight">
                Шилдэг бараа
              </h2>
              <span className="text-[11px] text-muted-foreground ml-1">
                · ширхэгээр
              </span>
            </div>
            {topProducts.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                Энэ хугацаанд бараа борлогдсонгүй.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {topProducts.map((p, i) => {
                  const max = topProducts[0].units;
                  const w = Math.max(4, (p.units / max) * 100);
                  return (
                    <li
                      key={p.id}
                      className="px-5 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <span className="size-6 rounded-full bg-muted text-muted-foreground text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold truncate">
                          {p.name}
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            style={{ width: `${w}%` }}
                            className="h-full bg-violet-500/70 dark:bg-violet-400/70 rounded-full"
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 leading-tight">
                        <div className="text-[13px] font-bold tabular-nums">
                          {p.units.toLocaleString("mn-MN")}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground tabular-nums">
                          {formatMnt(p.revenue)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top stores */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3.5 border-b flex items-center gap-2">
              <StoreIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[14px] font-bold tracking-tight">
                Шилдэг дэлгүүр
              </h2>
              <span className="text-[11px] text-muted-foreground ml-1">
                · орлогоор
              </span>
            </div>
            {topStores.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                Энэ хугацаанд орлого алга байна.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {topStores.map((s, i) => {
                  const max = topStores[0].revenue;
                  const w = Math.max(4, (s.revenue / max) * 100);
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(s.name)}`}
                        className="px-5 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                      >
                        <span className="size-6 rounded-full bg-muted text-muted-foreground text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold truncate">
                            {s.name}
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              style={{ width: `${w}%` }}
                              className="h-full bg-primary rounded-full"
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0 leading-tight">
                          <div className="text-[13px] font-bold tabular-nums">
                            {formatMnt(s.revenue)}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground tabular-nums">
                            {s.orders} захиалга
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-[15px] font-bold tracking-tight">
              Захиалгын төлөв
            </h2>
            <Link
              href="/admin/orders"
              className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"
            >
              Жагсаалт руу <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {(Object.keys(statusCounts) as OrderStatus[]).map((st) => {
              const n = statusCounts[st];
              const pct = Math.round((n / statusTotal) * 100);
              return (
                <div key={st} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 flex items-center gap-2">
                    <OrderStatusPill status={st} />
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${STATUS_SOLID[st]}`}
                      aria-label={`${STATUS_LABELS[st]} ${pct}%`}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-[12px] tabular-nums">
                    <span className="font-bold">{n}</span>
                    <span className="text-muted-foreground"> · {pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
