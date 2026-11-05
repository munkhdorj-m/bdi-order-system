import { StoreCatalogSkeleton } from "@/components/catalog/store-catalog";
import { RepBarSkeleton } from "@/components/page-skeletons";

export default function RepCatalogLoading() {
  return (
    <div>
      <RepBarSkeleton />
      <StoreCatalogSkeleton />
    </div>
  );
}
