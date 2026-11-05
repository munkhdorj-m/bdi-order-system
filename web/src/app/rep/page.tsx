import Link from "next/link";
import { Bell, LogOut, Store as StoreIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { addDays, todayUb, ubDayStart } from "@/lib/dispatch";
import { RepStoreList, type RepStore } from "@/components/rep/rep-store-list";

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

  // RLS: a rep only sees their own stores.
  const { data: stores, error } = await supabase
    .from("supermarkets")
    .select("id, name, district, address, contact_phone")
    .eq("active", true)
    .order("name");
  const rows = (stores as StoreRow[] | null) ?? [];

  // Latest order per store (recent window only — enough for "x ago") and
  // this UB month's count for the header.
  const today = todayUb();
  const lastOrder = new Map<string, string>();
  let monthCount = 0;
  if (rows.length > 0) {
    const ids = rows.map((s) => s.id);
    const [{ data: recent }, { count }] = await Promise.all([
      supabase
        .from("orders")
        .select("supermarket_id, created_at")
        .in("supermarket_id", ids)
        .neq("status", "cancelled")
        .gte("created_at", ubDayStart(addDays(today, -LOOKBACK_DAYS)))
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("supermarket_id", ids)
        .neq("status", "cancelled")
        .gte("created_at", ubDayStart(`${today.slice(0, 7)}-01`)),
    ]);
    for (const o of recent ?? []) {
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
              <div className="text-[11px] font-medium text-white/70">Төлөөлөгч</div>
              <div className="truncate text-[15px] font-semibold text-white">{name}</div>
            </div>
            <Link
              href="/notifications"
              aria-label="Мэдэгдэл"
              className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
                aria-label="Гарах"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile value={rows.length} label="Дэлгүүр" />
            <StatTile value={monthCount} label="Энэ сарын захиалга" />
            <StatTile value={warnCount} label="7+ өдөр захиалаагүй" warn={warnCount > 0} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-3 pt-2 sm:px-4">
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error.message}
          </div>
        )}

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
      <div className="text-[10.5px] leading-tight text-white/75">{label}</div>
    </div>
  );
}
