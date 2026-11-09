import { Suspense } from "react";
import Link from "next/link";
import { ClipboardList, FileSpreadsheet, Plus, Search, Truck, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
import { QuickAdvanceButton } from "@/components/admin/quick-advance-button";
import {
  OrderSelectionProvider,
  SelectManyCheckbox,
  SelectOrderCheckbox,
} from "@/components/admin/order-selection";
import {
  ACTIVE_STATUSES,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { formatMnt } from "@/lib/format";
import { addDays, isIsoDay, todayUb, ubDayStart } from "@/lib/dispatch";
import { formatDayMonthTime } from "@/lib/datetime";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  range?: string;
  from?: string;
  to?: string;
  /** Only this store's orders (linked from the store page). */
  store?: string;
}>;

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  created_at: string;
  delivery_date: string | null;
  supermarket_id: string;
  supermarkets: { name: string } | null;
};

/** What the store pays: lines minus the order-level discount. */
function amountOf(o: Pick<OrderRow, "subtotal" | "discount_total">): number {
  return Math.max(0, Number(o.subtotal ?? 0) - Number(o.discount_total ?? 0));
}

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

// "11.08 13:05" (mn-MN Intl would print "XI/08").
function formatShortDate(iso: string) {
  return formatDayMonthTime(iso);
}

/**
 * "yyyy-mm-dd" key + a Mongolian-localized "X сарын Y, Garig" label so
 * groupings match how the admin reads dates.
 */
function dayKeyOf(iso: string): string {
  // Group by the Mongolia calendar day (en-CA → yyyy-mm-dd), not the raw
  // UTC slice — otherwise orders near midnight land in the wrong day group.
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
  });
}
function dayLabelOf(iso: string): string {
  return new Date(iso).toLocaleDateString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
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
  // Ulaanbaatar days, whatever timezone the server runs in (Vercel is UTC:
  // a server-local midnight would start "today" at 08:00 UB).
  if (range) {
    const today = todayUb();
    const days = range === "today" ? 0 : range === "7d" ? 6 : 29;
    return { fromIso: ubDayStart(addDays(today, -days)), toIso: null };
  }
  if (!from && !to) return { fromIso: null, toIso: null };
  const fromIso = from && isIsoDay(from) ? ubDayStart(from) : null;
  // `to` is inclusive: everything before the next UB midnight.
  const toIso = to && isIsoDay(to) ? ubDayStart(addDays(to, 1)) : null;
  return { fromIso, toIso };
}

/**
 * Compose a URL preserving existing filters while flipping one. Used by
 * tab + chip clicks so changing status doesn't blow away the search/date
 * (or the store the list is narrowed to).
 */
function buildHref(params: {
  status?: string | null;
  q?: string;
  range?: string | null;
  from?: string;
  to?: string;
  store?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.store) sp.set("store", params.store);
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.range) sp.set("range", params.range);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

/** Every filter except status — counts and the list share it. */
type Scope = {
  store?: string;
  fromIso: string | null;
  toIso: string | null;
  /** Search words without PostgREST/LIKE specials; "" = no search. */
  term: string;
};

type StatusFilter = OrderStatus | "active" | null;

const LIST_SELECT =
  "id, order_number, status, subtotal, discount_total, created_at, delivery_date, supermarket_id, supermarkets:supermarket_id(name)";

/**
 * The orders query, once per search "part". With a search, orders are
 * found two ways that never overlap — order number matches (whose store
 * name doesn't), and store name matches — so counts add up exactly. This
 * replaced a store-id list that stopped at the first 200 matching stores.
 */
function scopedQueries(
  supabase: SupabaseClient,
  select: string,
  scope: Scope,
  opts: { head: boolean; status: StatusFilter },
) {
  const parts = scope.term ? (["number", "store"] as const) : (["all"] as const);
  const like = `%${scope.term}%`;
  return parts.map((part) => {
    const sel = part === "all" ? select : `${select}, sm:supermarket_id!inner(name)`;
    let q = supabase.from("orders").select(sel, opts.head ? { count: "exact", head: true } : undefined);
    if (scope.store) q = q.eq("supermarket_id", scope.store);
    if (scope.fromIso) q = q.gte("created_at", scope.fromIso);
    if (scope.toIso) q = q.lt("created_at", scope.toIso);
    if (opts.status === "active") q = q.in("status", ACTIVE_STATUSES);
    else if (opts.status) q = q.eq("status", opts.status);
    if (part === "number") q = q.ilike("order_number", like).not("sm.name", "ilike", like);
    if (part === "store") q = q.ilike("sm.name", like);
    return q;
  });
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
  const store = sp.store && /^[0-9a-f-]{36}$/i.test(sp.store) ? sp.store : undefined;
  const statusFilter: StatusFilter =
    status === "active" ? "active" : status && (STATUS_KEYS as readonly string[]).includes(status) ? (status as OrderStatus) : null;

  // Characters with meaning in PostgREST filters or LIKE can't be searched for.
  const term = q.replace(/[%_,()"\\*]/g, " ").replace(/\s+/g, " ").trim();
  const scope: Scope = { store, term, ...resolveDateBounds(range, from, to) };

  // Excel of what's on screen: the date filter as UB days (today if none),
  // the status tab and the store.
  const today = todayUb();
  const exportFrom =
    range === "today" ? today : range === "7d" ? addDays(today, -6) : range === "30d" ? addDays(today, -29) : (from ?? to ?? today);
  const exportTo = range ? today : (to ?? from ?? today);
  const exportParams = new URLSearchParams({ from: exportFrom, to: exportTo });
  if (statusFilter) exportParams.set("status", statusFilter);
  if (store) exportParams.set("store", store);
  const exportHref = `/admin/export?${exportParams}`;

  // Per-status counts under the SAME store/date/search filters as the
  // list, so the chips add up to what's shown.
  const supabase = await createClient();
  const countKeys: (OrderStatus | null)[] = [null, ...STATUS_KEYS];
  const counts = await Promise.all(
    countKeys.map(async (s) => {
      const res = await Promise.all(scopedQueries(supabase, "id", scope, { head: true, status: s }));
      return res.reduce((n, r) => n + (r.count ?? 0), 0);
    }),
  );
  const [totalCount, pendingCount, confirmedCount, shippedCount, deliveredCount, cancelledCount] = counts;
  const activeCount = pendingCount + confirmedCount + shippedCount;

  const tabs: { key: string | null; label: string; count: number }[] = [
    { key: null, label: "Бүгд", count: totalCount },
    { key: "active", label: "Идэвхтэй", count: activeCount },
    { key: "pending", label: STATUS_LABELS.pending, count: pendingCount },
    { key: "confirmed", label: STATUS_LABELS.confirmed, count: confirmedCount },
    { key: "shipped", label: STATUS_LABELS.shipped, count: shippedCount },
    { key: "delivered", label: STATUS_LABELS.delivered, count: deliveredCount },
    { key: "cancelled", label: STATUS_LABELS.cancelled, count: cancelledCount },
  ];
  const shownCount = tabs.find((t) => t.key === (statusFilter ?? null))?.count ?? totalCount;

  const datePresets: { key: RangePreset | null; label: string }[] = [
    { key: null, label: "Бүгд" },
    { key: "today", label: "Өнөөдөр" },
    { key: "7d", label: "7 хоног" },
    { key: "30d", label: "30 хоног" },
  ];

  const hasAnyFilter = Boolean(q || range || from || to);

  // Re-key Suspense so any filter change re-shows the skeleton instead of
  // holding stale rows during the re-fetch (and drops the ticked orders).
  const streamKey = [status ?? "all", q, range ?? "", from ?? "", to ?? "", store ?? ""].join(
    "|",
  );

  return (
    <div className="max-w-6xl pb-20">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Захиалга</h1>
          <p className="text-[13px] text-muted-foreground">
            Бүх захиалгуудыг шүүж харах · сонгоод падаан хэвлэх, Excel татах
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" title={`${exportFrom} → ${exportTo} хооронд захиалсан`}>
            <a href={exportHref}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/dispatch">
              <Truck className="h-4 w-4" />
              Хүргэлт хуваарлах
            </Link>
          </Button>
          <Button asChild>
            <Link href={store ? `/admin/orders/new?store=${store}` : "/admin/orders/new"}>
              <Plus className="h-4 w-4" />
              Шинэ захиалга
            </Link>
          </Button>
        </div>
      </div>

      {/* Status filter chips — counts follow the store/date/search filters.
          Hrefs keep search, date and store so flipping status keeps them. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (t.key === null && !statusFilter) || t.key === statusFilter;
          const href = buildHref({
            status: t.key,
            q,
            range,
            from,
            to,
            store,
          });
          return (
            <Link key={t.label} href={href} className="chip" data-active={active || undefined}>
              {t.label}
              <span className={`tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>{t.count}</span>
            </Link>
          );
        })}
      </div>

      {/* Search + date filter row. The form is server-rendered GET so submit
          updates the URL params; date preset chips are separate Links that
          set the `range` param without touching `q`. */}
      <Card className="p-3 sm:p-4 mb-4">
        <form method="get" className="flex flex-col sm:flex-row gap-2 sm:gap-3 min-w-0">
          {/* Preserve current status + range/date + store when searching */}
          {store && <input type="hidden" name="store" defaultValue={store} />}
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
              className="field pl-9 pr-11"
            />
            {q && (
              <Link
                href={buildHref({ status, range, from, to, store })}
                aria-label="Хайлт цэвэрлэх"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </Link>
            )}
          </div>

          <Button type="submit">
            <Search className="size-4" />
            Хайх
          </Button>
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
              store,
            });
            return (
              <Link key={p.label} href={href} className="chip h-9 px-3" data-active={active || undefined}>
                {p.label}
              </Link>
            );
          })}

          {/* Custom range — its own form so it doesn't clobber the search;
              it keeps the status, search and store. */}
          <form
            method="get"
            className="ml-auto flex items-center gap-1.5 text-[12px]"
          >
            {store && <input type="hidden" name="store" defaultValue={store} />}
            {status && (
              <input type="hidden" name="status" defaultValue={status} />
            )}
            {q && <input type="hidden" name="q" defaultValue={q} />}
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="field h-9 w-auto px-2.5 text-[13px]"
              aria-label="Эхэлсэн огноо"
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="field h-9 w-auto px-2.5 text-[13px]"
              aria-label="Дуусах огноо"
            />
            <Button type="submit" variant="outline" size="sm">
              Шүүх
            </Button>
            {(from || to) && (
              <Button asChild variant="ghost" size="sm">
                <Link href={buildHref({ status, q, store })}>Цэвэрлэх</Link>
              </Button>
            )}
          </form>
        </div>

        {hasAnyFilter && (
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            <Link
              href={buildHref({ status, store })}
              className="inline-flex min-h-10 items-center hover:text-foreground hover:underline"
            >
              Бүх шүүлтүүр цэвэрлэх
            </Link>
          </p>
        )}
      </Card>

      <Suspense key={streamKey} fallback={<OrderListSkeleton />}>
        <OrderList
          status={status}
          statusFilter={statusFilter}
          q={q}
          range={range}
          from={from}
          to={to}
          store={store}
          scope={scope}
          shownCount={shownCount}
        />
      </Suspense>
    </div>
  );
}

const LIST_LIMIT = 500;

async function OrderList({
  status,
  statusFilter,
  q,
  range,
  from,
  to,
  store,
  scope,
  shownCount,
}: {
  status?: string;
  statusFilter: StatusFilter;
  q?: string;
  range: RangePreset | null;
  from?: string;
  to?: string;
  store?: string;
  scope: Scope;
  /** How many orders match in total (the active chip's count). */
  shownCount: number;
}) {
  const supabase = await createClient();

  const [results, storeRow] = await Promise.all([
    Promise.all(
      scopedQueries(supabase, LIST_SELECT, scope, { head: false, status: statusFilter }).map((query) =>
        query.order("created_at", { ascending: false }).order("id").limit(LIST_LIMIT),
      ),
    ),
    store
      ? supabase.from("supermarkets").select("name").eq("id", store).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const error = results.find((r) => r.error)?.error ?? null;
  const byId = new Map<string, OrderRow>();
  for (const r of results) {
    for (const row of (r.data ?? []) as unknown as OrderRow[]) byId.set(row.id, row);
  }
  const rows = [...byId.values()]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, LIST_LIMIT);
  const storeName = (storeRow.data as { name: string } | null)?.name ?? null;

  // Which store this list is narrowed to, with a one-tap way back.
  const storeBanner = store ? (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13.5px] text-accent-foreground ring-1 ring-primary/20">
      <span>
        <b>{storeName ?? "Дэлгүүр"}</b> дэлгүүрийн захиалга
      </span>
      <Link href={`/admin/supermarkets/${store}`} className="font-semibold underline underline-offset-2">
        Дэлгүүр рүү
      </Link>
      <Link
        href={buildHref({ status, q, range: range ?? undefined, from, to })}
        className="ml-auto inline-flex min-h-10 items-center gap-1 font-semibold"
      >
        <X className="h-4 w-4" /> Бүх дэлгүүр
      </Link>
    </div>
  ) : null;

  if (error) {
    return (
      <Card className="p-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
        {error.message}
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        {storeBanner}
        <Card className="p-12 text-center text-muted-foreground">
          <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>Захиалга алга байна.</p>
        </Card>
      </>
    );
  }

  // Group rows by UB day while preserving the newest-first order. Money
  // totals count what stores pay (after discount) and leave cancelled
  // orders out — they're shown, struck through, but aren't sales.
  const groups: {
    key: string;
    label: string;
    rows: OrderRow[];
    total: number;
    live: number;
  }[] = [];
  const groupIndex = new Map<string, number>();
  let grandTotal = 0;
  let cancelled = 0;
  for (const r of rows) {
    const isCancelled = r.status === "cancelled";
    if (isCancelled) cancelled += 1;
    else grandTotal += amountOf(r);
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
        live: 0,
      });
    }
    groups[idx].rows.push(r);
    if (!isCancelled) {
      groups[idx].total += amountOf(r);
      groups[idx].live += 1;
    }
  }

  return (
    <OrderSelectionProvider>
      {storeBanner}
      {shownCount > rows.length && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-800/60">
          {shownCount.toLocaleString("mn-MN")} захиалгаас сүүлийн {rows.length}-г харуулж байна. Огноо эсвэл
          төлвөөр шүүж нарийсгана уу.
        </p>
      )}
      {/* Summary banner — total across whatever filters are active. */}
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
          {cancelled > 0 && <> · цуцлагдсан {cancelled} нь дүнд ороогүй</>}
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
            <div className="flex items-center gap-2 mb-2 px-1">
              <SelectManyCheckbox ids={g.rows.map((r) => r.id)} label={`${g.label} — бүгдийг сонгох`} />
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

            {/* Mobile: cards. The checkbox and the action sit beside the
                link, not inside it. */}
            <div className="sm:hidden space-y-2">
              {g.rows.map((o) => (
                <div
                  key={o.id}
                  className={`flex items-start gap-1 rounded-lg border bg-background p-2 ${o.status === "cancelled" ? "opacity-70" : ""}`}
                >
                  <SelectOrderCheckbox id={o.id} label={`${o.order_number} сонгох`} />
                  <Link href={`/admin/orders/${o.id}`} className="min-w-0 flex-1 py-1">
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
                  </Link>
                  <div className="flex flex-col items-end gap-2 shrink-0 py-1">
                    <div className={`text-sm font-semibold ${o.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                      {formatMnt(amountOf(o))}
                    </div>
                    <QuickAdvanceButton
                      orderId={o.id}
                      orderNumber={o.order_number}
                      status={o.status}
                      deliveryDate={o.delivery_date}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>Дугаар</TableHead>
                    <TableHead>Дэлгүүр</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Дүн</TableHead>
                    <TableHead>Огноо</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((o) => (
                    <TableRow key={o.id} className={o.status === "cancelled" ? "opacity-70" : undefined}>
                      <TableCell className="py-0.5">
                        <SelectOrderCheckbox id={o.id} label={`${o.order_number} сонгох`} />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {o.order_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link
                          href={buildHref({ store: o.supermarket_id })}
                          className="hover:text-primary hover:underline"
                          title="Энэ дэлгүүрийн бүх захиалга"
                        >
                          {o.supermarkets?.name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <OrderStatusPill status={o.status} />
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${o.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}
                      >
                        {formatMnt(amountOf(o))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(o.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <QuickAdvanceButton
                          orderId={o.id}
                          orderNumber={o.order_number}
                          status={o.status}
                          deliveryDate={o.delivery_date}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Day subtotal footer row — only on desktop where the
                      table grid makes alignment cheap. */}
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={4}
                      className="text-[12px] text-muted-foreground"
                    >
                      Өдрийн нийт · {g.live} захиалга
                      {g.rows.length > g.live && ` (цуцлагдсан ${g.rows.length - g.live} ороогүй)`}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatMnt(g.total)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </section>
        ))}
      </div>
    </OrderSelectionProvider>
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
