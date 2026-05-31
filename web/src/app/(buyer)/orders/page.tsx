import Link from "next/link";
import { Check, ClipboardList, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMnt } from "@/lib/format";
import {
  ACTIVE_STATUSES,
  STATUS_LABELS,
  STATUS_STEPS,
  isFinal,
  statusStepIndex,
  type OrderStatus,
} from "@/lib/order-status";

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  /** Supabase aggregate join — array with one {count} entry. */
  order_items: Array<{ count: number }>;
};

type FilterKey = "active" | "delivered" | "all";

type SearchParams = Promise<{ status?: string }>;

function parseFilter(v: string | undefined): FilterKey {
  return v === "delivered" || v === "all" ? v : "active";
}

function formatShortDateTime(iso: string) {
  return new Date(iso).toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const day = Math.floor(diffMs / 86_400_000);
  if (day < 1) return "өнөөдөр";
  if (day < 2) return "өчигдөр";
  if (day < 30) return `${day} өдрийн өмнө`;
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Pick the right "where are we" line for each status. Falls back to the
 * order date for cancelled or pre-confirmation orders.
 */
function etaLine(o: OrderRow): string {
  switch (o.status) {
    case "pending":
      return "Дэлгүүр баталгаажуулахыг хүлээж байна";
    case "confirmed":
      return o.confirmed_at
        ? `${formatRelativeDate(o.confirmed_at)} баталгаажсан`
        : "Баталгаажсан";
    case "shipped":
      return o.shipped_at
        ? `${formatRelativeDate(o.shipped_at)} илгээгдсэн`
        : "Хүргэлтэнд гарсан";
    case "delivered":
      return o.delivered_at
        ? `${formatRelativeDate(o.delivered_at)} хүргэгдсэн`
        : "Хүргэгдсэн";
    case "cancelled":
      return "Захиалга цуцлагдсан";
  }
}

const STATUS_PILL: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-900 ring-amber-300/60 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800/60",
  confirmed:
    "bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] text-primary ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]",
  shipped:
    "bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] text-primary ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]",
  delivered:
    "bg-emerald-50 text-emerald-800 ring-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60",
  cancelled:
    "bg-rose-50 text-rose-700 ring-rose-300/60 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/60",
};

const STATUS_DOT: Record<OrderStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-primary",
  shipped: "bg-primary",
  delivered: "bg-emerald-500",
  cancelled: "bg-rose-500",
};

function ProgressBar({ status }: { status: OrderStatus }) {
  // For cancelled orders, no step is lit.
  const step =
    status === "cancelled" ? -1 : statusStepIndex(status);
  return (
    <div className="flex gap-1 mt-3">
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

  return (
    <Link
      href={`/orders/${o.id}`}
      className="block rounded-3xl bg-card ring-1 ring-border overflow-hidden hover:shadow-md hover:shadow-[color-mix(in_oklch,var(--primary)_15%,transparent)] hover:ring-[color-mix(in_oklch,var(--primary)_30%,transparent)] transition-all"
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
              Захиалга
            </div>
            <div className="text-[14px] font-bold tracking-tight font-mono">
              {o.order_number}
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-bold ${STATUS_PILL[o.status]}`}
          >
            <span
              className={`size-1.5 rounded-full ${STATUS_DOT[o.status]}`}
            />
            {STATUS_LABELS[o.status]}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            {formatShortDateTime(o.created_at)} · {items} бараа
          </span>
          <span className="text-[15px] font-bold text-foreground tabular-nums">
            {formatMnt(o.subtotal)}
          </span>
        </div>

        <ProgressBar status={o.status} />

        <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
          <span>{etaLine(o)}</span>
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

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, created_at, confirmed_at, shipped_at, delivered_at, order_items(count)",
    )
    .order("created_at", { ascending: false });

  if (filter === "active") {
    query = query.in("status", ACTIVE_STATUSES);
  } else if (filter === "delivered") {
    query = query.eq("status", "delivered");
  }

  const { data } = await query;
  const rows = (data as unknown as OrderRow[]) ?? [];

  // Tab counts — derived from the "all" set so the badge stays honest
  // regardless of which tab the buyer is on. Extra round-trip is cheap and
  // gets cached server-side.
  let activeCount = 0;
  if (filter !== "all") {
    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ACTIVE_STATUSES);
    activeCount = count ?? 0;
  } else {
    activeCount = rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;
  }

  const tabs: { key: FilterKey; label: string; badge?: number }[] = [
    { key: "active", label: "Идэвхтэй", badge: activeCount || undefined },
    { key: "delivered", label: "Хүргэгдсэн" },
    { key: "all", label: "Бүгд" },
  ];

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
      <h1 className="text-[22px] font-bold tracking-tight">Захиалгууд</h1>

      {/* Filter tabs — pill style, primary when active. URL-driven so the
          state survives reloads and back/forward navigation. */}
      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:-mx-4 sm:px-4">
        {tabs.map((t) => {
          const active = t.key === filter;
          const href =
            t.key === "active" ? "/orders" : `/orders?status=${t.key}`;
          return (
            <Link
              key={t.key}
              href={href}
              className={`shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold transition-all flex items-center gap-1.5 ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
                  : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-muted/80 dark:hover:bg-muted/60"
              }`}
            >
              {t.label}
              {t.badge != null && (
                <span
                  className={`tabular-nums ${active ? "opacity-80" : "text-foreground/70"}`}
                >
                  · {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "active"
              ? "Идэвхтэй захиалга алга байна."
              : "Захиалга алга байна."}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {rows.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </div>
      )}
    </div>
  );
}
