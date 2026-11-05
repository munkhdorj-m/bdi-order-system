import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Eye, PackagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  StoreCatalog,
  StoreCatalogSkeleton,
} from "@/components/catalog/store-catalog";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ q?: string; category?: string }>;

/**
 * The catalog exactly as this store sees it: its own prices, the
 * categories in order, what it ordered before. For checking prices and how
 * the catalog looks after edits. Nothing added here becomes an order.
 */
export default async function AdminStoreCatalogPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { q, category } = await searchParams;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("supermarkets")
    .select("id, name, price_lists:price_list_id(name)")
    .eq("id", id)
    .maybeSingle();
  if (!store) notFound();
  const priceList = (store as unknown as { price_lists: { name: string } | null }).price_lists?.name;
  const basePath = `/admin/supermarkets/${id}/catalog`;

  return (
    <div className="max-w-7xl">
      <Link
        href={`/admin/supermarkets/${id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" />
        Дэлгүүр рүү буцах
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary shrink-0" />
            <span className="truncate">{store.name as string}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Дэлгүүрт харагдах каталог · Үнийн жагсаалт: {priceList ?? "Үндсэн үнэ"}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/admin/orders/new?store=${id}`}>
            <PackagePlus className="h-4 w-4" />
            Захиалга оруулах
          </Link>
        </Button>
      </div>
      <p className="text-[12.5px] text-muted-foreground mb-2">
        Энд сагсанд нэмсэн бараа захиалга болохгүй. Захиалга оруулахдаа «Захиалга оруулах» товчийг дарна уу.
      </p>

      <div className="-mx-3 sm:-mx-4 lg:-mx-6 xl:-mx-8">
        <Suspense key={q ?? ""} fallback={<StoreCatalogSkeleton />}>
          <StoreCatalog
            storeId={id}
            mode="preview"
            q={q}
            initialCategory={category}
            basePath={basePath}
            productHref={(productId) => `/admin/products/${productId}`}
            cartScope={{ storeId: `preview:${id}` }}
          />
        </Suspense>
      </div>
    </div>
  );
}
