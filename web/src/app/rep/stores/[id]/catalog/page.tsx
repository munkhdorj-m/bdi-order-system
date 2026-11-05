import { Suspense } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RepHeader } from "@/components/rep/rep-header";
import {
  StoreCatalog,
  StoreCatalogSkeleton,
} from "@/components/catalog/store-catalog";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ q?: string; category?: string }>;

type StoreContext = {
  name: string;
  district: string | null;
};

export default async function RepCatalogPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { q, category } = await searchParams;
  const supabase = await createClient();

  const { data: storeRaw } = await supabase
    .from("supermarkets")
    .select("name, district")
    .eq("id", id)
    .single();

  if (!storeRaw) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        Дэлгүүр олдсонгүй эсвэл хандах эрхгүй.
      </div>
    );
  }
  const store = storeRaw as unknown as StoreContext;
  const basePath = `/rep/stores/${id}/catalog`;

  return (
    <div>
      <RepHeader
        title={store.name}
        subtitle="Каталог · захиалга авч байна"
        backHref={`/rep/stores/${id}`}
        cartHref={`/rep/stores/${id}/cart`}
        cartScope={{ storeId: id }}
      />

      <div className="max-w-5xl mx-auto">
        {/* Which store this order is for (its name is also in the bar). */}
        <div className="px-3 pt-3 sm:px-4">
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] ring-1 ring-amber-300/70 dark:bg-amber-950/40 dark:ring-amber-800/60">
            <ClipboardList className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={2.2} />
            <span className="min-w-0 flex-1 truncate text-amber-950 dark:text-amber-100">
              <b className="font-semibold">{store.name}</b>
              {store.district ? ` · ${store.district}` : ""} — үнэ нь энэ дэлгүүрийнх
            </span>
            <Link href="/rep" className="shrink-0 font-semibold text-amber-900 underline dark:text-amber-200">
              Солих
            </Link>
          </div>
        </div>

        <Suspense key={q ?? ""} fallback={<StoreCatalogSkeleton />}>
          <StoreCatalog
            storeId={id}
            mode="rep"
            q={q}
            initialCategory={category}
            basePath={basePath}
            productHref={(productId) => `${basePath}/${productId}`}
            cartScope={{ storeId: id }}
            cartHref={`/rep/stores/${id}/cart`}
          />
        </Suspense>
      </div>
    </div>
  );
}
