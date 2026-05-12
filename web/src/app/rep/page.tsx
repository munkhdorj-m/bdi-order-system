import Link from "next/link";
import { ChevronRight, LogOut, Store as StoreIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";

type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  active: boolean;
};

function formatRelative(iso: string | null) {
  if (!iso) return "Захиалга байхгүй";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return min < 1 ? "одоо" : `${min} мин өмнө захиалсан`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} цаг өмнө захиалсан`;
  const day = Math.floor(hr / 24);
  return `${day} өдрийн өмнө захиалсан`;
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

  // Latest-order timestamps per store for "x time ago" hint
  const orderTimes = new Map<string, string>();
  if (rows.length > 0) {
    const ids = rows.map((s) => s.id);
    const { data: orderRows } = await supabase
      .from("orders")
      .select("supermarket_id, created_at")
      .in("supermarket_id", ids)
      .order("created_at", { ascending: false });
    (orderRows ?? []).forEach((o) => {
      if (!orderTimes.has(o.supermarket_id)) {
        orderTimes.set(o.supermarket_id, o.created_at);
      }
    });
  }

  return (
    <div>
      <header className="sticky top-0 z-10 h-14 border-b bg-background flex items-center px-3 sm:px-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">
            Миний дэлгүүрүүд
          </div>
          <div className="text-[11px] text-muted-foreground leading-tight truncate">
            {session.profile.full_name ?? session.email}
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="p-2 rounded-md hover:bg-muted"
            aria-label="Гарах"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>

      <main className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
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
          <ul className="space-y-2">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/rep/stores/${s.id}`}
                  className="block bg-background border rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatRelative(orderTimes.get(s.id) ?? null)}
                      </div>
                      {s.address && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {s.address}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
