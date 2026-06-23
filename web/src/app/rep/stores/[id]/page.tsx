import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Phone, Plus, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { RepHeader } from "@/components/rep/rep-header";
import { formatMnt } from "@/lib/format";

type Params = Promise<{ id: string }>;

type Store = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  district: string | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
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

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: store }, { data: orders }, { count: monthCount }] =
    await Promise.all([
      supabase
        .from("supermarkets")
        .select(
          "id, name, address, contact_phone, district, profiles:assigned_rep_id(full_name, phone)",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("orders")
        .select("id, order_number, status, subtotal, created_at")
        .eq("supermarket_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("supermarket_id", id)
        .gte("created_at", startOfMonth.toISOString()),
    ]);

  if (!store) notFound();
  const s = store as unknown as Store;
  const rows = (orders as OrderRow[] | null) ?? [];

  // Cheap stats: avg subtotal, cadence (avg gap between orders in days).
  const avgOrder =
    rows.length > 0
      ? Math.round(rows.reduce((a, r) => a + r.subtotal, 0) / rows.length)
      : 0;
  const cadenceDays =
    rows.length >= 2
      ? Math.round(
          (new Date(rows[0].created_at).getTime() -
            new Date(rows[rows.length - 1].created_at).getTime()) /
            (1000 * 60 * 60 * 24) /
            (rows.length - 1),
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
        {/* Hero — brand-tinted card with avatar, contact, call CTA */}
        <div className="rounded-3xl ring-1 ring-border bg-gradient-to-br from-[color-mix(in_oklch,var(--primary)_5%,var(--card))] to-card p-4">
          <div className="flex items-start gap-3">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground flex items-center justify-center font-bold text-[18px] shrink-0">
              {storeInitial(s.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] font-bold tracking-tight">{s.name}</h1>
              {(s.district || s.address) && (
                <p className="text-[12px] text-muted-foreground truncate">
                  {[s.district, s.address].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {s.contact_phone && (
              <a
                href={`tel:${s.contact_phone.replace(/\s/g, "")}`}
                aria-label="Дэлгүүрт залгах"
                className="size-10 rounded-xl bg-card ring-1 ring-border text-primary flex items-center justify-center active:scale-95 transition-transform"
              >
                <Phone className="h-4 w-4" strokeWidth={2.2} />
              </a>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-[12px]">
            {s.profiles?.full_name && (
              <div className="flex items-center gap-1.5">
                <User
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={2.2}
                />
                <span className="font-semibold truncate">
                  {s.profiles.full_name}
                </span>
              </div>
            )}
            {s.contact_phone && (
              <div className="flex items-center gap-1.5">
                <Phone
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={2.2}
                />
                <span className="font-mono">{s.contact_phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Primary "order on behalf" CTA */}
        <Link
          href={`/rep/stores/${id}/catalog`}
          className="mt-3 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Захиалга үүсгэх · нэрийн өмнөөс
        </Link>

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
          <div className="mt-3 rounded-2xl ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] bg-[color-mix(in_oklch,var(--primary)_5%,var(--card))] p-3 flex items-center gap-2 text-[12px]">
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
                    {formatMnt(o.subtotal)}
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
