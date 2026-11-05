import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { RepHeader } from "@/components/rep/rep-header";
import { formatMnt } from "@/lib/format";
import { todayUb, ubDayStart } from "@/lib/dispatch";
import { RepStoreCta } from "@/components/rep/rep-store-cta";

type Params = Promise<{ id: string }>;

type Store = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  district: string | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number | null;
  created_at: string;
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    month: "2-digit",
    day: "2-digit",
  });
}

function storeInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "•";
}

export default async function RepStoreDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // This month in Ulaanbaatar time (the server runs in UTC).
  const monthStart = ubDayStart(`${todayUb().slice(0, 7)}-01`);

  const [{ data: store }, { data: orders }, { count: monthCount }] =
    await Promise.all([
      supabase
        .from("supermarkets")
        .select("id, name, address, contact_phone, district")
        .eq("id", id)
        .single(),
      supabase
        .from("orders")
        .select("id, order_number, status, subtotal, discount_total, created_at")
        .eq("supermarket_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("supermarket_id", id)
        .neq("status", "cancelled")
        .gte("created_at", monthStart),
    ]);

  if (!store) notFound();
  const s = store as unknown as Store;
  const rows = (orders as OrderRow[] | null) ?? [];
  const net = (o: OrderRow) => o.subtotal - (o.discount_total ?? 0);
  const placed = rows.filter((r) => r.status !== "cancelled");

  // Cheap stats: avg subtotal, cadence (avg gap between orders in days).
  const avgOrder =
    placed.length > 0
      ? Math.round(placed.reduce((a, r) => a + net(r), 0) / placed.length)
      : 0;
  const cadenceDays =
    placed.length >= 2
      ? Math.round(
          (new Date(placed[0].created_at).getTime() -
            new Date(placed[placed.length - 1].created_at).getTime()) /
            (1000 * 60 * 60 * 24) /
            (placed.length - 1),
        )
      : null;
  const activeCount = rows.filter((r) =>
    ACTIVE_STATUSES.includes(r.status),
  ).length;

  return (
    <div>
      <RepHeader
        title={s.name}
        subtitle={s.contact_phone ?? undefined}
        backHref="/rep"
        cartHref={`/rep/stores/${id}/cart`}
        cartScope={{ storeId: id }}
      />

      <main className="px-3 sm:px-4 py-3 max-w-2xl mx-auto pb-6">
        {/* Who and where, with a one-tap call. */}
        <div className="rounded-3xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-start gap-3">
            <div className="size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-[19px] shrink-0">
              {storeInitial(s.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-sans text-[18px] font-bold leading-tight tracking-tight">{s.name}</h1>
              {(s.district || s.address) && (
                <p className="mt-1 flex items-start gap-1 text-[12.5px] leading-snug text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span className="line-clamp-2">{[s.district, s.address].filter(Boolean).join(" · ")}</span>
                </p>
              )}
            </div>
            {s.contact_phone && (
              <a
                href={`tel:${s.contact_phone.replace(/\s/g, "")}`}
                aria-label="Дэлгүүрт залгах"
                className="size-11 shrink-0 rounded-xl bg-primary/8 ring-1 ring-primary/15 text-primary flex items-center justify-center active:scale-95 transition-transform"
              >
                <Phone className="h-4 w-4" strokeWidth={2.2} />
              </a>
            )}
          </div>
        </div>

        {/* Order for this store — or finish the cart already started. */}
        <RepStoreCta storeId={id} />

        {/* Stats — month total / avg order / cadence */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile value={String(monthCount ?? 0)} label="Энэ сард" sub="захиалга" />
          <StatTile
            value={avgOrder > 0 ? formatMnt(avgOrder) : "—"}
            label="Дундаж"
            sub="захиалга"
          />
          <StatTile
            value={cadenceDays != null ? `${cadenceDays} өдөр` : "—"}
            label="Давтамж"
            sub="тутамд"
          />
        </div>

        {/* Active count strip — only shows when there's open orders */}
        {activeCount > 0 && (
          <div className="mt-3 rounded-2xl ring-1 ring-primary/20 bg-primary/5 p-3 flex items-center gap-2 text-[12.5px]">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-foreground/80">
              <span className="font-bold tabular-nums">{activeCount}</span>{" "}
              идэвхтэй захиалга
            </span>
          </div>
        )}

        {/* Recent orders list */}
        <div className="mt-5">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
              Сүүлийн захиалга
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="rounded-2xl bg-card ring-1 ring-border px-4 py-8 text-center text-[13px] text-muted-foreground">
              Захиалга байхгүй байна.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((o) => (
                <Link
                  key={o.id}
                  href={`/rep/orders/${o.id}`}
                  className="rounded-2xl bg-card ring-1 ring-border p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
                >
                  <span
                    className={`size-2 rounded-full ${
                      o.status === "delivered"
                        ? "bg-emerald-500"
                        : o.status === "cancelled"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12.5px] font-semibold font-mono">
                        {o.order_number}
                      </span>
                      <OrderStatusPill status={o.status} />
                    </div>
                    <div className="text-[10.5px] text-muted-foreground mt-0.5">
                      {formatShortDate(o.created_at)}
                    </div>
                  </div>
                  <div className="text-[13px] font-bold tabular-nums">
                    {formatMnt(net(o))}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatTile({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-3 text-center">
      <div className="text-[16px] font-bold tabular-nums tracking-tight">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground mt-0.5">
        {label}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}
