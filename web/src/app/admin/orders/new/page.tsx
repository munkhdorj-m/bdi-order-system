import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import { todayUb } from "@/lib/dispatch";
import { OrderCreateForm, type StorePickOption } from "@/components/admin/order-create-form";
import { loadStoreCatalog, type CatalogRow, type StoreSummary } from "./actions";

type SearchParams = Promise<{ store?: string }>;

/** Every store for the picker (paged past the 1,000-row API cap). */
async function allStores(): Promise<StorePickOption[]> {
  const supabase = await createClient();
  const out: StorePickOption[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("supermarkets")
      .select("id, name, address, registry_number, active")
      .order("active", { ascending: false })
      .order("name")
      .order("id")
      .range(out.length, out.length + 999);
    if (error || !data || data.length === 0) break;
    out.push(...(data as StorePickOption[]));
  }
  return out;
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
