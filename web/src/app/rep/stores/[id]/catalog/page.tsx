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
  profiles: { full_name: string | null; phone: string | null } | null;
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

  // Store + its buyer, so the banner names who the rep is ordering for.
  const { data: storeRaw } = await supabase
    .from("supermarkets")
    .select("name, district, profiles:assigned_rep_id(full_name, phone)")
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
  const onBehalfOf =
    store.profiles?.full_name ?? store.profiles?.phone ?? "Худалдан авагч";
  const basePath = `/rep/stores/${id}/catalog`;

  return (
    <div>
      <RepHeader
        title="Каталог"
        subtitle={`${store.name} · нэрийн өмнөөс`}
        backHref={`/rep/stores/${id}`}
        cartHref={`/rep/stores/${id}/cart`}
        cartScope={{ storeId: id }}
      />

      <div className="max-w-5xl mx-auto">
        {/* Which store this order is for — always on screen at the top. */}
        <div className="px-3 sm:px-4 pt-3">
          <div className="rounded-2xl ring-2 ring-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/30 dark:ring-amber-700/60 p-3 flex items-center gap-3 shadow-sm">
            <div className="size-10 rounded-xl bg-white ring-1 ring-amber-300/60 dark:bg-amber-950/60 dark:ring-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <ClipboardList className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-[9.5px] uppercase tracking-[0.12em] font-bold text-amber-900/80 dark:text-amber-300/80">
                Нэрийн өмнөөс захиалж байна
              </div>
              <div className="text-[13.5px] font-bold text-amber-950 dark:text-amber-100 truncate">
                {store.name} · {onBehalfOf}
              </div>
              <div className="text-[10.5px] text-amber-900/80 dark:text-amber-300/80">
                Үнэ нь энэ дэлгүүрийн үнийн жагсаалтаар
              </div>
            </div>
            <Link
              href="/rep"
              className="text-[11.5px] font-bold text-amber-900 dark:text-amber-200 underline shrink-0"
            >
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
          />
        </Suspense>
      </div>
    </div>
  );
}
