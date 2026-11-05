import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import {
  StoreCatalog,
  StoreCatalogSkeleton,
} from "@/components/catalog/store-catalog";

type SearchParams = Promise<{ q?: string; category?: string }>;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, category } = await searchParams;
  const session = await requireSession();
  const storeId = session.profile.supermarket_id!;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] bg-background">
      <h1 className="sr-only">Каталог</h1>
      {/* Keyed by the search so the skeleton shows while new results stream. */}
      <Suspense key={q ?? ""} fallback={<StoreCatalogSkeleton />}>
        <StoreCatalog
          storeId={storeId}
          mode="buyer"
          q={q}
          initialCategory={category}
          basePath="/catalog"
          productHref={(id) => `/catalog/${id}`}
        />
      </Suspense>
    </div>
  );
}
