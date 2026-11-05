import { StoreCatalogSkeleton } from "@/components/catalog/store-catalog";

export default function RepCatalogLoading() {
  return (
    <div>
      <div className="sticky top-0 z-10 h-14 glass-strong" />
      <StoreCatalogSkeleton />
    </div>
  );
}
