import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import { todayUb } from "@/lib/dispatch";
import { OrderCreateForm, type StorePickOption } from "@/components/admin/order-create-form";
import { loadStoreCatalog, type CatalogRow, type StoreSummary } from "./actions";

type SearchParams = Promise<{ store?: string }>;

const STORE_PAGE = 1000;

/**
 * Every store for the picker (the picker filters on the phone, instantly).
 * The first page also brings the total, the rest load side by side; any
 * failed page fails the whole list (shown by admin/error.tsx with a retry)
 * instead of quietly leaving stores out.
 */
async function allStores(): Promise<StorePickOption[]> {
  const supabase = await createClient();
  const page = (from: number, count = false) =>
    supabase
      .from("supermarkets")
      .select("id, name, address, registry_number, active", count ? { count: "exact" } : undefined)
      .order("active", { ascending: false })
      .order("name")
      .order("id")
      .range(from, from + STORE_PAGE - 1);

  const first = await page(0, true);
  if (first.error) throw new Error(`Дэлгүүрийн жагсаалт: ${first.error.message}`);
  const out = [...((first.data ?? []) as StorePickOption[])];
  const total = first.count ?? out.length;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(total / STORE_PAGE) - 1) }, (_, i) => page((i + 1) * STORE_PAGE)),
  );
  for (const r of rest) {
    if (r.error) throw new Error(`Дэлгүүрийн жагсаалт: ${r.error.message}`);
    out.push(...((r.data ?? []) as StorePickOption[]));
  }
  // De-dupe in case a store was added between pages.
  return [...new Map(out.map((s) => [s.id, s])).values()];
}

/** Staff order entry — Mercury's "Нэмэх". `?store=<id>` preselects a store. */
export default async function NewOrderPage({ searchParams }: { searchParams: SearchParams }) {
  const { store } = await searchParams;
  const [stores, initial, categories] = await Promise.all([
    allStores(),
    store ? loadStoreCatalog(store) : Promise.resolve(null),
    getCategories(),
  ]);
  const initialStore: StoreSummary | null = initial?.store ?? null;
  const initialRows: CatalogRow[] = initial?.rows ?? [];

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/orders"
        className="inline-flex items-center text-[12.5px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" />
        Захиалга жагсаалт руу
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Шинэ захиалга</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Дэлгүүрийн нэрээр захиалга оруулна. Үнэ нь тухайн дэлгүүрийн үнийн жагсаалтаар бодогдоно.
      </p>
      <OrderCreateForm
        stores={stores}
        categories={categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
        today={todayUb()}
        initialStore={initialStore}
        initialRows={initialRows}
      />
    </div>
  );
}
