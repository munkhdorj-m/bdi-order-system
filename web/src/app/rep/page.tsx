import Link from "next/link";
import { Bell, ChevronRight, ClipboardList, Store as StoreIcon, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { requireSession } from "@/lib/auth";
import { addDays, todayUb, ubDayStart } from "@/lib/dispatch";
import { myDistributor } from "@/lib/delivery-runs";
import { RepStoreList, type RepStore } from "@/components/rep/rep-store-list";
import { SignOutButton } from "@/components/buyer/sign-out-button";

type StoreRow = {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  contact_phone: string | null;
};

// How far back "last order" looks. Older than this reads "60+ өдөр".
const LOOKBACK_DAYS = 60;

function relative(iso: string | null, now: number): { label: string; warn: boolean } {
  if (!iso) return { label: `${LOOKBACK_DAYS}+ өдөр захиалаагүй`, warn: true };
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 60) return { label: min < 1 ? "Дөнгөж сая" : `${min} мин өмнө`, warn: false };
  const hr = Math.floor(min / 60);
  if (hr < 24) return { label: `${hr} цагийн өмнө`, warn: false };
  const day = Math.floor(hr / 24);
  // A week without an order → flag it for the rep.
  return { label: `${day} өдрийн өмнө`, warn: day > 7 };
}

export default async function MyStoresPage() {
  const session = await requireSession();
  const supabase = await createClient();

  // RLS: a rep only sees their own stores. Alongside: is this login also a
  // delivery person (then the page links to their delivery runs)?
  const [{ data: stores, error }, { distributor }] = await Promise.all([
    supabase
      .from("supermarkets")
      .select("id, name, district, address, contact_phone")
      .eq("active", true)
      .order("name"),
    myDistributor(session.userId),
  ]);
  // Shown by rep/error.tsx, whose "Дахин оролдох" loads the page again —
  // better than an empty list that looks like "no stores".
  if (error) throw new Error(`Дэлгүүрийн жагсаалт ачаалж чадсангүй: ${error.message}`);
  const rows = (stores as StoreRow[] | null) ?? [];

  // Latest order per store (recent window only — enough for "x ago") and
  // this UB month's count for the header. RLS already limits orders to the
  // rep's own stores. Every row of the window is read (page by page): a
  // big territory passes PostgREST's 1,000-row cap in 60 days, and the cut
  // would mark busy stores "60+ өдөр".
  const today = todayUb();
  const lastOrder = new Map<string, string>();
  let monthCount = 0;
  if (rows.length > 0) {
    const [recent, { count }] = await Promise.all([
      fetchAll<{ supermarket_id: string; created_at: string }>(() =>
        supabase
          .from("orders")
          .select("supermarket_id, created_at")
          .neq("status", "cancelled")
          .gte("created_at", ubDayStart(addDays(today, -LOOKBACK_DAYS)))
          .order("created_at", { ascending: false })
          .order("id"),
      ).catch(() => []),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .gte("created_at", ubDayStart(`${today.slice(0, 7)}-01`)),
    ]);
    for (const o of recent) {
      if (!lastOrder.has(o.supermarket_id)) lastOrder.set(o.supermarket_id, o.created_at);
    }
    monthCount = count ?? 0;
  }

  const now = new Date().getTime();
  const list: RepStore[] = rows.map((s) => {
    const r = relative(lastOrder.get(s.id) ?? null, now);
    return { ...s, lastLabel: r.label, warn: r.warn };
  });
  const warnCount = list.filter((s) => s.warn).length;

  const name = session.profile.full_name ?? session.profile.phone ?? "—";
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="on-brand bg-brand-bar text-brand-bar-foreground">
        <div className="mx-auto max-w-2xl px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gold font-display text-[13px] font-bold text-gold-foreground shadow-sm">
              {initials || "Т"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[12px] font-medium text-white/75">Төлөөлөгч</div>
              <div className="truncate text-[15px] font-semibold text-white">{name}</div>
            </div>
            <Link
              href="/notifications"
              aria-label="Мэдэгдэл"
              className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </Link>
            <SignOutButton
              title={session.profile.phone ?? undefined}
              className="bg-white/10 ring-1 ring-white/15"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile value={rows.length} label="Дэлгүүр" />
            <StatTile value={monthCount} label="Энэ сарын захиалга" />
            <StatTile value={warnCount} label="7+ өдөр захиалаагүй" warn={warnCount > 0} />
          </div>

          {/* The delivery person's runs (only for a login linked to a Түгээгч). */}
          {distributor && (
            <Link
              href="/rep/delivery"
              className="mt-2 flex h-11 items-center gap-2.5 rounded-xl bg-gold px-3 text-gold-foreground shadow-sm"
            >
              <Truck className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
              <span className="flex-1 text-[14px] font-semibold">Хүргэлт</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
            </Link>
          )}

          {/* Every order across the rep's stores: today's, pending, by status. */}
          <Link
            href="/rep/orders"
            className="mt-2 flex h-11 items-center gap-2.5 rounded-xl bg-white/10 px-3 ring-1 ring-white/15"
          >
            <ClipboardList className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
            <span className="flex-1 text-[14px] font-semibold text-white">Миний захиалгууд</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-3 pt-2 sm:px-4">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <StoreIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Танд хариуцсан дэлгүүр алга байна. BDI-н админтай холбогдоно уу.
          </div>
        ) : (
          <RepStoreList stores={list} />
        )}
      </main>
    </div>
  );
}

function StatTile({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ring-1 ${warn ? "bg-gold/25 ring-gold/40" : "bg-white/10 ring-white/15"}`}>
      <div className="font-display text-[19px] font-semibold tabular-nums leading-tight text-white">{value}</div>
      <div className="text-[12px] leading-tight text-white/80">{label}</div>
    </div>
  );
}
