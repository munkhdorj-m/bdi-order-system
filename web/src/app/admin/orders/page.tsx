import { Suspense } from "react";
import Link from "next/link";
import { ClipboardList, FileSpreadsheet, Plus, Search, Truck, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatDayLabel, formatDayMonthTime } from "@/lib/datetime";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  range?: string;
  from?: string;
  to?: string;
  /** Only this store's orders (linked from the store page). */
  store?: string;
  /** How many orders to show (grows by PAGE_SIZE with "Цааш үзэх"). */
  n?: string;
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
// "11-р сарын 9, Даваа"
function dayLabelOf(iso: string): string {
  return formatDayLabel(iso);
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
  const limit = Math.min(MAX_ROWS, Math.max(PAGE_SIZE, Math.floor(Number(sp.n) || PAGE_SIZE)));

  // Re-key Suspense so any filter change re-shows the skeleton instead of
  // holding stale rows during the re-fetch (and drops the ticked orders).
  const streamKey = [status ?? "all", q, range ?? "", from ?? "", to ?? "", store ?? "", limit].join("|");

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
            className="flex w-full min-w-0 items-center gap-1.5 text-[12px] sm:ml-auto sm:w-auto"
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
              className="field h-10 min-w-0 flex-1 px-2.5 text-[13px] sm:h-9 sm:w-auto sm:flex-none"
              aria-label="Эхэлсэн огноо"
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="field h-10 min-w-0 flex-1 px-2.5 text-[13px] sm:h-9 sm:w-auto sm:flex-none"
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
          limit={limit}
        />
      </Suspense>
    </div>
  );
}

/** Orders per "page"; "Цааш үзэх" adds another page, up to MAX_ROWS. */
const PAGE_SIZE = 100;
const MAX_ROWS = 500;

/**
 * One order = one <tr>, laid out twice by CSS: a stacked card where the
 * list is narrow (the row becomes a small grid), a normal table row where
 * it is at least 59rem wide — the 800px of fixed columns plus a store name
 * that is still readable — so columns size themselves and line up. (Rendering a card list AND a table and hiding one of them doubled
 * the page for every order.)
 *
 * The switch follows the LIST's width, not the screen's: the table's fixed
 * columns add up to 800px, and the sidebar takes 240px on wide screens. At
 * the `sm` screen breakpoint the table was wider than its box on anything
 * between a tablet and a small laptop, and its last column was cut off.
 */
const ROW =
  "relative grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-x-2 gap-y-1 border-b border-border px-1.5 py-2.5 " +
  "transition-colors last:border-b-0 even:bg-muted/45 hover:bg-accent/70 @min-[59rem]:table-row @min-[59rem]:p-0";
const TH =
  "h-10 px-3 text-left align-middle text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-foreground/70";
const TD = "block @min-[59rem]:table-cell @min-[59rem]:px-3 @min-[59rem]:py-2 @min-[59rem]:align-middle";

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
  limit,
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
  /** How many of them to show. */
  limit: number;
}) {
  const supabase = await createClient();

  const [results, storeRow] = await Promise.all([
    Promise.all(
      scopedQueries(supabase, LIST_SELECT, scope, { head: false, status: statusFilter }).map((query) =>
        query.order("created_at", { ascending: false }).order("id").limit(limit),
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
    .slice(0, limit);
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
        <p className="mb-3 rounded-xl bg-accent px-3 py-2 text-[13px] text-accent-foreground ring-1 ring-primary/15">
          {shownCount.toLocaleString("en-US")} захиалгаас сүүлийн {rows.length}-г харуулж байна. Доор «Цааш үзэх»
          дарж нэмж харах эсвэл огноо, төлвөөр шүүнэ үү.
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

      {/* Day-grouped list: a heading per day (label, count, total), then
          its orders. */}
      <div className="@container space-y-5">
        {groups.map((g, gi) => (
          <section key={g.key}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <SelectManyCheckbox ids={g.rows.map((r) => r.id)} label={`${g.label} — бүгдийг сонгох`} />
              <h2 className="text-[14px] font-bold tracking-tight">{g.label}</h2>
              <span className="min-w-0 truncate text-[12px] text-muted-foreground tabular-nums">
                · {g.live} захиалга
                {g.rows.length > g.live && ` (+${g.rows.length - g.live} цуцлагдсан)`}
              </span>
              <span className="ml-auto font-display text-[13.5px] font-bold tabular-nums">{formatMnt(g.total)}</span>
            </div>

            <div className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/80 dark:ring-border">
              {/* Fixed column widths, so the columns line up from one day's
                  table to the next; the store name takes what is left. */}
              <table className="block w-full text-sm @min-[59rem]:table @min-[59rem]:table-fixed">
                <colgroup className="hidden @min-[59rem]:table-column-group">
                  <col className="w-11" />
                  <col className="w-[9.75rem]" />
                  <col />
                  <col className="w-[11.25rem]" />
                  <col className="w-[7.5rem]" />
                  <col className="w-[7.25rem]" />
                  <col className="w-[11.5rem]" />
                </colgroup>
                {/* Column titles once, on the first day; the columns below
                    line up with them. */}
                {gi === 0 && (
                  <thead className="hidden bg-muted @min-[59rem]:table-header-group">
                    <tr className="border-b border-border">
                      <th />
                      <th className={TH}>Дугаар</th>
                      <th className={TH}>Дэлгүүр</th>
                      <th className={TH}>Төлөв</th>
                      <th className={`${TH} text-right`}>Дүн</th>
                      <th className={TH}>Огноо</th>
                      <th />
                    </tr>
                  </thead>
                )}
                <tbody className="block @min-[59rem]:table-row-group">
                  {g.rows.map((o) => {
                    const isCancelled = o.status === "cancelled";
                    return (
                      <tr key={o.id} className={`${ROW} ${isCancelled ? "opacity-70" : ""}`}>
                        <td className={`${TD} relative z-[1] col-start-1 row-span-4 row-start-1 @min-[59rem]:w-11 @min-[59rem]:py-0.5 @min-[59rem]:pl-2 @min-[59rem]:pr-0`}>
                          <SelectOrderCheckbox id={o.id} label={`${o.order_number} сонгох`} />
                        </td>
                        <td className={`${TD} col-start-2 row-start-1 whitespace-nowrap`}>
                          {/* On phones the whole card opens the order (the
                              link is stretched over it); in the table, only
                              the number does. */}
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="font-mono text-sm font-medium after:absolute after:inset-0 hover:underline @min-[59rem]:after:hidden"
                          >
                            {o.order_number}
                          </Link>
                        </td>
                        <td className={`${TD} col-start-2 row-start-3 min-w-0`}>
                          <Link
                            href={buildHref({ store: o.supermarket_id })}
                            className="block truncate hover:text-primary hover:underline"
                            title="Энэ дэлгүүрийн бүх захиалга"
                          >
                            {o.supermarkets?.name ?? "—"}
                          </Link>
                        </td>
                        <td className={`${TD} col-start-2 row-start-2`}>
                          <OrderStatusPill status={o.status} />
                        </td>
                        <td
                          className={`${TD} col-start-3 row-start-1 justify-self-end whitespace-nowrap font-semibold tabular-nums @min-[59rem]:text-right @min-[59rem]:font-medium ${isCancelled ? "line-through text-muted-foreground" : ""}`}
                        >
                          {formatMnt(amountOf(o))}
                        </td>
                        <td className={`${TD} col-start-2 row-start-4 whitespace-nowrap text-xs text-muted-foreground tabular-nums @min-[59rem]:text-[13px]`}>
                          {formatShortDate(o.created_at)}
                        </td>
                        <td className={`${TD} relative z-[1] col-start-3 row-span-3 row-start-2 self-end justify-self-end @min-[59rem]:py-1 @min-[59rem]:text-right`}>
                          <QuickAdvanceButton
                            orderId={o.id}
                            orderNumber={o.order_number}
                            status={o.status}
                            deliveryDate={o.delivery_date}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {shownCount > rows.length && rows.length >= limit && limit < MAX_ROWS && (
        <div className="mt-5 flex justify-center">
          <Button asChild variant="outline">
            <Link
              href={`${buildHref({ status, q, range: range ?? undefined, from, to, store })}${
                buildHref({ status, q, range: range ?? undefined, from, to, store }).includes("?") ? "&" : "?"
              }n=${Math.min(MAX_ROWS, limit + PAGE_SIZE)}`}
              scroll={false}
            >
              Цааш үзэх (өмнөх {Math.min(PAGE_SIZE, shownCount - rows.length)})
            </Link>
          </Button>
        </div>
      )}
    </OrderSelectionProvider>
  );
}

function OrderListSkeleton() {
  return (
    <>
      <Skeleton className="mb-3 h-11 w-full rounded-xl" />
      <Skeleton className="mb-2 h-4 w-48" />
      <div className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/80">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0">
            <Skeleton className="size-5 rounded" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-6 w-28 rounded-full sm:block" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </>
  );
}
