import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getCategories } from "@/lib/categories";
import { categoryIconKey } from "@/lib/category-visual";
import type { CartProductInfo } from "@/lib/cart";
import { RepCartView } from "@/components/rep/rep-cart-view";

type Params = Promise<{ id: string }>;

type CatalogRow = {
  product_id: string;
  effective_price: number;
  category_id: string | null;
  image_url: string | null;
  stock: number | null;
};

/** The rep's cart for one store (the cart itself lives on the phone). */
export default async function RepCartPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: store }, catalogRows, categories] = await Promise.all([
    supabase.from("supermarkets").select("name").eq("id", id).maybeSingle(),
    // Today's catalog for this store, to re-sync a cart saved earlier
    // (price, category, photo) and show what's out of stock.
    fetchAll<CatalogRow>(() =>
      supabase
        .from("supermarket_prices")
        .select("product_id, effective_price, category_id, image_url, stock")
        .eq("supermarket_id", id)
        .order("product_id"),
    ).catch(() => null),
    getCategories(),
  ]);
  if (!store) notFound();

  const catById = new Map(categories.map((c) => [c.id, c]));
  const catalog: Record<string, CartProductInfo> | undefined = catalogRows
    ? Object.fromEntries(
        catalogRows.map((r) => [
          r.product_id,
          {
            price: Number(r.effective_price) || 0,
            category_id: r.category_id ?? null,
            image_url: r.image_url ?? null,
            category_icon: categoryIconKey(r.category_id ? catById.get(r.category_id) ?? null : null),
            stock: Number(r.stock) || 0,
          } satisfies CartProductInfo,
        ]),
      )
    : undefined;

  return <RepCartView storeId={id} storeName={store.name as string} catalog={catalog} />;
}
