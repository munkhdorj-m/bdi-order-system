import { Suspense } from "react";
import Link from "next/link";
import { ClipboardList, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import {
  ACTIVE_STATUSES,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { formatMnt } from "@/lib/format";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  range?: string;
  from?: string;
  to?: string;
}>;

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  created_at: string;
  supermarkets: { name: string } | null;
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

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "yyyy-mm-dd" key + a Mongolian-localized "X сарын Y, Garig" label so
 * groupings match how the admin reads dates.
 */
function dayKeyOf(iso: string): string {
  return iso.slice(0, 10);
}
function dayLabelOf(iso: string): string {
  return new Date(iso).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

const STATUS_KEYS = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const RANGE_PRESETS = ["today", "7d", "30d"] as const;
type RangePreset = (typeof RANGE_PRESETS)[number];

function parseRange(v: string | undefined): RangePreset | null {
  return RANGE_PRESETS.includes(v as RangePreset) ? (v as RangePreset) : null;
}

/**
 * Turn the `range` preset (or explicit from/to) into ISO date bounds.
 * Returns nulls when no date filter is active.
 */
function resolveDateBounds(
  range: RangePreset | null,
  from: string | undefined,
  to: string | undefined,
): { fromIso: string | null; toIso: string | null } {
  if (range) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === "today") {
      return { fromIso: start.toISOString(), toIso: null };
    }
    if (range === "7d") {
      start.setDate(start.getDate() - 6);
      return { fromIso: start.toISOString(), toIso: null };
    }
    // 30d
    start.setDate(start.getDate() - 29);
    return { fromIso: start.toISOString(), toIso: null };
  }
  if (!from && !to) return { fromIso: null, toIso: null };
  // Custom range — interpret yyyy-mm-dd as local-midnight bounds.
  const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : null;
  // Treat `to` as inclusive-end-of-day so picking the same date as `from`
  // yields a 24-hour window rather than 1 microsecond.
  const toIso = to ? new Date(`${to}T23:59:59.999`).toISOString() : null;
  return { fromIso, toIso };
}

/**
 * Compose a URL preserving existing filters while flipping one. Used by
 * tab + chip clicks so changing status doesn't blow away the search/date.
 */
function buildHref(params: {
  status?: string | null;
  q?: string;
  range?: string | null;
  from?: string;
  to?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.range) sp.set("range", params.range);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q?.trim() ?? "";
  const range = parseRange(sp.range);
  const from = sp.from?.trim() || undefined;
  const to = sp.to?.trim() || undefined;

  // Per-status head counts so the filter chips can show honest tallies
  // regardless of which tab is active. Six head-only queries in parallel.
  const supabase = await createClient();
  const [
    { count: totalCount },
    { count: pendingCount },
    { count: confirmedCount },
    { count: shippedCount },
    { count: deliveredCount },
    { count: cancelledCount },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "shipped"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "delivered"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled"),
  ]);

  const activeCount =
    (pendingCount ?? 0) + (confirmedCount ?? 0) + (shippedCount ?? 0);

  const tabs: { key: string | null; label: string; count: number }[] = [
    { key: null, label: "Бүгд", count: totalCount ?? 0 },
    { key: "active", label: "Идэвхтэй", count: activeCount },
    { key: "pending", label: STATUS_LABELS.pending, count: pendingCount ?? 0 },
    {
      key: "confirmed",
      label: STATUS_LABELS.confirmed,
      count: confirmedCount ?? 0,
    },
    { key: "shipped", label: STATUS_LABELS.shipped, count: shippedCount ?? 0 },
    {
      key: "delivered",
      label: STATUS_LABELS.delivered,
      count: deliveredCount ?? 0,
    },
    {
      key: "cancelled",
      label: STATUS_LABELS.cancelled,
      count: cancelledCount ?? 0,
    },
  ];

  const datePresets: { key: RangePreset | null; label: string }[] = [
    { key: null, label: "Бүгд" },
    { key: "today", label: "Өнөөдөр" },
    { key: "7d", label: "7 хоног" },
    { key: "30d", label: "30 хоног" },
  ];

  const hasAnyFilter = Boolean(q || range || from || to);

  // Re-key Suspense so any filter change re-shows the skeleton instead of
  // holding stale rows during the re-fetch.
  const streamKey = [status ?? "all", q, range ?? "", from ?? "", to ?? ""].join(
    "|",
  );

  return (
    <div className="max-w-6xl">
      <div className="mb-4">
        <h1 className="text-[26px] font-bold tracking-tight">Захиалга</h1>
        <p className="text-[13px] text-muted-foreground">
          Бүх захиалгуудыг шүүж харах
        </p>
      </div>

      {/* Status filter chips — primary fill for active, muted ring for inactive.
          Hrefs preserve search + date filters so flipping status doesn't blow
          them away. */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 mb-3 scrollbar-thin">
        {tabs.map((t) => {
          const active = (t.key === null && !status) || t.key === status;
          const href = buildHref({
            status: t.key,
            q,
            range,
            from,
            to,
          });
          return (
            <Link
              key={t.label}
              href={href}
              className={`whitespace-nowrap shrink-0 rounded-full px-3.5 h-8 inline-flex items-center gap-1 text-[12px] font-semibold transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
                  : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-muted/80 dark:hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {t.label}
              <span
                className={`tabular-nums ${active ? "opacity-80" : "text-foreground/60"}`}
              >
                · {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Search + date filter row. The form is server-rendered GET so submit
          updates the URL params; date preset chips are separate Links that
          set the `range` param without touching `q`. */}
      <Card className="p-3 sm:p-4 mb-4">
        <form method="get" className="flex flex-col sm:flex-row gap-2 sm:gap-3 min-w-0">
          {/* Preserve current status + range/date when submitting the search */}
          {status && (
            <input type="hidden" name="status" defaultValue={status} />
          )}
          {range && <input type="hidden" name="range" defaultValue={range} />}
          {from && <input type="hidden" name="from" defaultValue={from} />}
          {to && <input type="hidden" name="to" defaultValue={to} />}

          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Захиалгын дугаар эсвэл дэлгүүрийн нэрээр хайх..."
              className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {q && (
              <Link
                href={buildHref({ status, range, from, to })}
                aria-label="Хайлт цэвэрлэх"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <button
            type="submit"
            className="h-9 px-3.5 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/80 active:scale-[0.97] transition-all whitespace-nowrap"
          >
            Хайх
          </button>
        </form>

        {/* Date preset chips + custom from/to. Presets clear the custom range
            and vice versa, so the user always has one source of truth for date. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground mr-1">
            Огноо
          </span>
          {datePresets.map((p) => {
            const active =
              (p.key === null && !range && !from && !to) || p.key === range;
            const href = buildHref({
              status,
              q,
              range: p.key,
              // Drop custom range when picking a preset
              from: undefined,
              to: undefined,
            });
            return (
              <Link
                key={p.label}
                href={href}
                className={`h-7 px-2.5 rounded-full text-[11.5px] font-semibold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-muted/80 hover:text-foreground dark:hover:bg-muted/60"
                }`}
              >
                {p.label}
              </Link>
            );
          })}

          {/* Custom range — only render the inputs and submit form when the
              admin actually fills them. They live in a separate form so they
              don't clobber the q + preset state. */}
          <form
            method="get"
            className="ml-auto flex items-center gap-1.5 text-[12px]"
          >
            {status && (
              <input type="hidden" name="status" defaultValue={status} />
            )}
            {q && <input type="hidden" name="q" defaultValue={q} />}
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="h-8 rounded-md border border-input bg-background px-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Эхэлсэн огноо"
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="h-8 rounded-md border border-input bg-background px-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Дуусах огноо"
            />
            <button
              type="submit"
              className="h-8 px-2.5 rounded-md bg-secondary text-secondary-foreground text-[12px] font-semibold hover:bg-secondary/80 active:scale-[0.97] transition-all"
            >
              Шүүх
            </button>
            {(from || to) && (
              <Link
                href={buildHref({ status, q, range })}
                className="h-8 px-2.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center"
              >
                Цэвэрлэх
              </Link>
            )}
          </form>
        </div>

        {hasAnyFilter && (
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            <Link
              href={buildHref({ status })}
              className="hover:text-foreground hover:underline"
            >
              Бүх шүүлтүүр цэвэрлэх
            </Link>
          </p>
        )}
      </Card>

      <Suspense key={streamKey} fallback={<OrderListSkeleton />}>
        <OrderList status={status} q={q} range={range} from={from} to={to} />
      </Suspense>
    </div>
  );
}

async function OrderList({
  status,
  q,
  range,
  from,
  to,
}: {
  status?: string;
  q?: string;
  range: RangePreset | null;
  from?: string;
  to?: string;
}) {
  const supabase = await createClient();

  // Resolve the search term against supermarket names — Supabase doesn't
  // ILIKE through embedded relations cleanly, so we do a 2-step: get matching
  // store IDs, then filter orders by (order_number ILIKE %q% OR
  // supermarket_id IN matchingIds).
  let matchingSupermarketIds: string[] = [];
  if (q) {
    const term = q.replace(/[%_]/g, "\\$&");
    const { data: stores } = await supabase
      .from("supermarkets")
      .select("id")
      .ilike("name", `%${term}%`);
    matchingSupermarketIds = ((stores as Array<{ id: string }> | null) ?? []).map(
      (s) => s.id,
    );
  }

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, created_at, supermarkets:supermarket_id(name)",
    )
    .order("created_at", { ascending: false });

  if (status === "active") {
    query = query.in("status", ACTIVE_STATUSES);
  } else if (status && (STATUS_KEYS as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }

  if (q) {
    const term = q.replace(/[%_]/g, "\\$&");
    // PostgREST `.or()` accepts the in.(...) format for the supermarket
    // bucket; quote the UUIDs so an empty list short-circuits to false
    // rather than syntax-erroring.
    const idsClause =
      matchingSupermarketIds.length > 0
        ? `supermarket_id.in.(${matchingSupermarketIds.join(",")})`
        : null;
    const orParts = [`order_number.ilike.%${term}%`];
    if (idsClause) orParts.push(idsClause);
    query = query.or(orParts.join(","));
  }

  const { fromIso, toIso } = resolveDateBounds(range, from, to);
  if (fromIso) query = query.gte("created_at", fromIso);
  if (toIso) query = query.lte("created_at", toIso);

  const { data, error } = await query;
  const rows = (data as unknown as OrderRow[]) ?? [];

  if (error) {
    return (
      <Card className="p-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
        {error.message}
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>Захиалга алга байна.</p>
      </Card>
    );
  }

  // Group rows by yyyy-mm-dd while preserving the existing newest-first
  // order. Each group carries its own subtotal so the admin can scan the
  // day's revenue without doing mental math.
  const groups: {
    key: string;
    label: string;
    rows: OrderRow[];
    total: number;
  }[] = [];
  const groupIndex = new Map<string, number>();
  let grandTotal = 0;
  for (const r of rows) {
    grandTotal += Number(r.subtotal ?? 0);
    const key = dayKeyOf(r.created_at);
    let idx = groupIndex.get(key);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(key, idx);
      groups.push({
        key,
        label: dayLabelOf(r.created_at),
        rows: [],
        total: 0,
      });
    }
    groups[idx].rows.push(r);
    groups[idx].total += Number(r.subtotal ?? 0);
  }

  return (
    <>
      {/* Summary banner — total across whatever filters are active, with
          the per-day count broken out so the admin sees revenue context
          at a glance. */}
      <div className="mb-3 rounded-xl bg-card ring-1 ring-border px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12.5px] text-muted-foreground">
          Нийт{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {rows.length}
          </span>{" "}
          захиалга ·{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {groups.length}
          </span>{" "}
          өдөр
        </div>
        <div className="text-[14px] font-bold tabular-nums">
          {formatMnt(grandTotal)}
        </div>
      </div>

      {/* Day-grouped list. Each group has its own header showing the day
          label + count + subtotal, then the rows underneath. */}
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.key}>
            <div className="flex items-center gap-3 mb-2 px-1">
              <h2 className="text-[13px] font-bold tracking-tight">
                {g.label}
              </h2>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                · {g.rows.length}
              </span>
              <span className="ml-auto text-[12.5px] font-bold tabular-nums">
                {formatMnt(g.total)}
              </span>
            </div>

            {/* Mobile: card list */}
            <div className="sm:hidden space-y-2">
              {g.rows.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="block bg-background border rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">
                          {o.order_number}
                        </span>
                        <OrderStatusPill status={o.status} />
                      </div>
                      <div className="text-sm mt-1 truncate">
                        {o.supermarkets?.name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatShortDate(o.created_at)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold shrink-0">
                      {formatMnt(o.subtotal)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дугаар</TableHead>
                    <TableHead>Дэлгүүр</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Дүн</TableHead>
                    <TableHead>Огноо</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {o.order_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.supermarkets?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <OrderStatusPill status={o.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMnt(o.subtotal)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(o.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Day subtotal footer row — only on desktop where the
                      table grid makes alignment cheap. */}
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={3}
                      className="text-[12px] text-muted-foreground"
                    >
                      Өдрийн нийт · {g.rows.length} захиалга
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatMnt(g.total)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}

function OrderListSkeleton() {
  return (
    <>
      <Skeleton className="h-3 w-20 mb-3" />
      {/* Mobile */}
      <div className="sm:hidden space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-background border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
      {/* Desktop */}
      <Card className="hidden sm:block p-3">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
