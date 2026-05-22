import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock,
  LogOut,
  Phone,
  Store as StoreIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";

type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  active: boolean;
};

type StoreStatus = "ok" | "warn";

function formatRelative(iso: string | null): {
  label: string;
  status: StoreStatus;
} {
  if (!iso) return { label: "Захиалга байхгүй", status: "warn" };
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60)
    return { label: min < 1 ? "Одоо" : `${min} мин өмнө`, status: "ok" };
  const hr = Math.floor(min / 60);
  if (hr < 24) return { label: `${hr} цаг өмнө`, status: "ok" };
  const day = Math.floor(hr / 24);
  // > 7 days without an order → flag for the rep's attention
  return {
    label: `${day} өдрийн өмнө`,
    status: day > 7 ? "warn" : "ok",
  };
}

function storeInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "•";
}

export default async function MyStoresPage() {
  const session = await requireSession();
  const supabase = await createClient();

  // Per RLS, a rep can only see their assigned supermarkets, so no extra filter needed.
  const { data: stores, error } = await supabase
    .from("supermarkets")
    .select("id, name, address, contact_phone, active")
    .order("name");

  const rows = (stores as StoreRow[] | null) ?? [];

  // Latest-order timestamps per store for "x time ago" hint + monthly counts
  // for the gradient header's stat strip.
  const orderTimes = new Map<string, string>();
  let monthCount = 0;
  if (rows.length > 0) {
    const ids = rows.map((s) => s.id);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ data: orderRows }, { count: monthOrders }] = await Promise.all([
      supabase
        .from("orders")
        .select("supermarket_id, created_at")
        .in("supermarket_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("supermarket_id", ids)
        .gte("created_at", startOfMonth.toISOString()),
    ]);

    (orderRows ?? []).forEach((o) => {
      if (!orderTimes.has(o.supermarket_id)) {
        orderTimes.set(o.supermarket_id, o.created_at);
      }
    });
    monthCount = monthOrders ?? 0;
  }

  const enriched = rows.map((s) => ({
    ...s,
    relative: formatRelative(orderTimes.get(s.id) ?? null),
  }));
  const warnCount = enriched.filter((s) => s.relative.status === "warn").length;

  const repInitials = (session.profile.full_name ?? session.email ?? "—")
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Branded gradient header per Hi-Fi RepStoresList */}
      <header
        className="relative text-primary-foreground"
        style={{
          background:
            "linear-gradient(160deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 80%, black) 100%)",
        }}
      >
        <div className="px-4 pt-8 pb-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center font-bold text-[13px]">
              {repInitials || "Р"}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-80 font-semibold">
                Төлөөлөгч
              </div>
              <div className="text-[14px] font-bold truncate">
                {session.profile.full_name ?? session.email ?? "—"}
              </div>
            </div>
            <button className="size-9 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
              <Bell className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="size-9 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center"
                aria-label="Гарах"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile value={String(rows.length)} label="Хариуцлагатай" />
            <StatTile value={String(monthCount)} label="Энэ сард" />
            <StatTile
              value={String(warnCount)}
              label="⚠ Анхаарах"
              warn={warnCount > 0}
            />
          </div>
        </div>
        <div className="h-4 bg-background rounded-t-3xl" />
      </header>

      <main className="flex-1 px-3 sm:px-4 max-w-2xl mx-auto w-full">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
            {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <StoreIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Танд хариуцагч дэлгүүр алга байна. BDI-н админтай холбогдоно уу.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {enriched.map((s) => {
              const isWarn = s.relative.status === "warn";
              return (
                <li key={s.id}>
                  <Link
                    href={`/rep/stores/${s.id}`}
                    className={`block rounded-2xl bg-card p-3.5 flex items-center gap-3 ring-1 transition-all hover:shadow-md ${
                      isWarn
                        ? "ring-amber-300/60 hover:shadow-amber-100/40"
                        : "ring-border"
                    }`}
                  >
                    <div
                      className={`size-11 rounded-2xl flex items-center justify-center font-bold text-[15px] shrink-0 ${
                        isWarn
                          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300/60 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800/60"
                          : "bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground"
                      }`}
                    >
                      {storeInitial(s.name)}
                    </div>

                    <div className="flex-1 min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13.5px] font-bold truncate">
                          {s.name}
                        </span>
                        {isWarn && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0"
                            strokeWidth={2.2}
                          />
                        )}
                      </div>
                      {s.contact_phone && (
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <Phone className="h-3 w-3" strokeWidth={2.2} />
                          <span className="font-mono">{s.contact_phone}</span>
                        </div>
                      )}
                      <div
                        className={`text-[11px] mt-0.5 flex items-center gap-1 ${
                          isWarn
                            ? "text-amber-700 dark:text-amber-300 font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-3 w-3" strokeWidth={2.2} />
                        <span>{s.relative.label}</span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function StatTile({
  value,
  label,
  warn = false,
}: {
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl ${
        warn
          ? "bg-amber-400/30 ring-1 ring-amber-200/40"
          : "bg-white/10 ring-1 ring-white/15"
      } backdrop-blur px-3 py-2`}
    >
      <div className="text-[18px] font-bold tabular-nums leading-tight">
        {value}
      </div>
      <div className="text-[10px] opacity-85">{label}</div>
    </div>
  );
}
