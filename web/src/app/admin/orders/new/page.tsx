import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCategories } from "@/lib/categories";
import { getAllStores } from "@/lib/stores";
import { todayUb } from "@/lib/dispatch";
import { OrderCreateForm, type StorePickOption } from "@/components/admin/order-create-form";
import { loadStoreCatalog, type CatalogRow, type StoreSummary } from "./actions";

type SearchParams = Promise<{ store?: string }>;

/**
 * Every store for the picker (the picker filters in the browser, instantly).
 * From the shared, cached store list — see lib/stores.ts.
 */
async function allStores(): Promise<StorePickOption[]> {
  const rows = await getAllStores();
  return rows.map(({ id, name, address, registry_number, active }) => ({ id, name, address, registry_number, active }));
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
