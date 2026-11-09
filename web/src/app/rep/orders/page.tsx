import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, Store as StoreIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { RepHeader } from "@/components/rep/rep-header";
import { formatMnt } from "@/lib/format";
import { formatDeliveryDay } from "@/lib/delivery";
import { todayUb, ubDayOf, ubDayStart } from "@/lib/dispatch";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/order-status";

type SearchParams = Promise<{ f?: string; n?: string }>;

type FilterKey = "today" | "pending" | "active" | "delivered" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Өнөөдөр" },
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "active", label: "Идэвхтэй" },
  { key: "delivered", label: "Хүргэгдсэн" },
  { key: "all", label: "Бүгд" },
];

/** Orders per page; "Цааш үзэх" shows this many more. */
const PAGE = 30;
const MAX_ROWS = 300;

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  created_at: string;
  delivery_date: string | null;
  placed_by: string | null;
  supermarkets: { id: string; name: string } | null;
};

function parseFilter(v: string | undefined): FilterKey {
  return FILTERS.some((f) => f.key === v) ? (v as FilterKey) : "today";
}

/** "14:05" today, "11/06 14:05" on other days — Ulaanbaatar time. */
function when(iso: string, today: string): string {
  const time = new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = ubDayOf(iso);
  if (day === today) return time;
  const [, m, d] = day.split("-");
  return `${m}/${d} ${time}`;
}

/**
 * "Миний захиалгууд" — every order across the rep's stores (RLS limits
 * orders to their stores): today's, the ones still waiting for the
 * office, by status. Placed by the rep or by the store itself.
 */
export default async function RepOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = parseFilter(sp.f);
  const limit = Math.min(MAX_ROWS, Math.max(PAGE, Math.floor(Number(sp.n) || PAGE)));
  const today = todayUb();

  const session = await requireSession();
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, discount_total, created_at, delivery_date, placed_by, supermarkets:supermarket_id(id, name)",
    )
    .order("created_at", { ascending: false })
    // One extra row tells whether there's more to show.
    .range(0, limit);
  if (filter === "today") query = query.gte("created_at", ubDayStart(today));
  else if (filter === "pending") query = query.eq("status", "pending");
  else if (filter === "active") query = query.in("status", ACTIVE_STATUSES);
  else if (filter === "delivered") query = query.eq("status", "delivered");

  const [{ data, error }, { count: pendingCount }] = await Promise.all([
    query,
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (error) throw new Error(`Захиалга ачаалж чадсангүй: ${error.message}`);

  const all = (data as unknown as OrderRow[] | null) ?? [];
  const hasMore = all.length > limit;
  const rows = hasMore ? all.slice(0, limit) : all;
  const net = (o: OrderRow) => (Number(o.subtotal) || 0) - (Number(o.discount_total) || 0);
  const shownTotal = rows.filter((o) => o.status !== "cancelled").reduce((s, o) => s + net(o), 0);

  const hrefFor = (key: FilterKey, n?: number) => {
    const params = new URLSearchParams();
    if (key !== "today") params.set("f", key);
    if (n) params.set("n", String(n));
    const qs = params.toString();
    return qs ? `/rep/orders?${qs}` : "/rep/orders";
  };

  return (
    <div>
      <RepHeader title="Миний захиалгууд" subtitle="Бүх дэлгүүрийн захиалга" backHref="/rep" />

      <main className="mx-auto max-w-2xl px-3 py-4 sm:px-4">
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Link
                key={f.key}
                href={hrefFor(f.key)}
                className="chip h-10"
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
              >
                {f.label}
                {f.key === "pending" && (pendingCount ?? 0) > 0 && (
                  <span className={`tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {rows.length > 0 && (
          <p className="mt-3 px-1 text-[13px] text-muted-foreground">
            <b className="font-semibold text-foreground tabular-nums">{rows.length}</b>
            {hasMore ? "+" : ""} захиалга
            {shownTotal > 0 && (
              <>
                {" "}· <b className="font-semibold text-foreground tabular-nums">{formatMnt(shownTotal)}</b>
              </>
            )}
          </p>
        )}

        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-60" />
            <p className="text-[14px] text-muted-foreground">
              {filter === "today" ? "Өнөөдөр захиалга алга байна." : "Захиалга алга байна."}
            </p>
            <Button asChild size="lg" variant="gold" className="mt-5">
              <Link href="/rep">
                <StoreIcon className="size-4" />
                Дэлгүүр сонгож захиалга авах
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 pb-6">
            {rows.map((o) => {
              const planned =
                o.delivery_date && ACTIVE_STATUSES.includes(o.status) ? formatDeliveryDay(o.delivery_date) : null;
              const mine = o.placed_by === session.userId;
              return (
                <li key={o.id}>
                  <Link
                    href={`/rep/orders/${o.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border shadow-card transition-shadow hover:shadow-raised"
                  >
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold">
                          {o.supermarkets?.name ?? "Дэлгүүр"}
                        </span>
                        {!mine && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            Дэлгүүр өөрөө
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12.5px] text-muted-foreground">{o.order_number}</span>
                        <OrderStatusPill status={o.status} />
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {when(o.created_at, today)}
                        {planned && (
                          <span className="inline-flex items-center gap-1 font-semibold text-primary">
                            {" "}· <CalendarDays className="h-3 w-3" strokeWidth={2.2} /> Хүргэх: {planned}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[14px] font-bold tabular-nums">{formatMnt(net(o))}</div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
            {hasMore && (
              <li>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href={hrefFor(filter, limit + PAGE)} scroll={false}>
                    Цааш үзэх
                  </Link>
                </Button>
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
