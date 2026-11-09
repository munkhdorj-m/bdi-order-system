import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CartView } from "@/components/buyer/cart-view";
import {
  formatNextDeliveryLabel,
  resolveDeliveryDay,
} from "@/lib/delivery";
import { rulesForPriceList, type DiscountRule } from "@/lib/discount";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getCategories } from "@/lib/categories";
import { categoryIconKey } from "@/lib/category-visual";
import type { CartProductInfo } from "@/lib/cart";

type CatalogRow = {
  product_id: string;
  effective_price: number;
  category_id: string | null;
  image_url: string | null;
  stock: number | null;
};

/**
 * Buyer cart route. Server component that resolves the delivery weekday
 * for the buyer's store, the active deals and today's catalog (price,
 * category, photo, stock per product), then hands everything to the
 * client CartView, which owns the local cart and re-syncs it on open.
 */
export default async function CartPage() {
  const session = await requireSession();
  // The (buyer) layout only lets a store user with a store through.
  const supermarketId = session.profile.supermarket_id!;
  const supabase = await createClient();

  // Store, deals, today's catalog and the categories in one round trip.
  // RLS already limits discounts to active ones in their date window;
  // rules not aimed at this store's price list are dropped below (fix 30).
  const [{ data: store }, { data: discountRows }, catalogRows, categories] = await Promise.all([
    supabase
      .from("supermarkets")
      .select("name, district, delivery_day, price_list_id")
      .eq("id", supermarketId)
      .maybeSingle(),
    supabase
      .from("discounts")
      .select(
        "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, ends_at, target_mode, target_price_list_ids",
      ),
    fetchAll<CatalogRow>(() =>
      supabase
        .from("supermarket_prices")
        .select("product_id, effective_price, category_id, image_url, stock")
        .eq("supermarket_id", supermarketId)
        .order("product_id"),
    ).catch(() => null),
    getCategories(),
  ]);

  const deliveryLabel = store
    ? formatNextDeliveryLabel(
        resolveDeliveryDay({ storeDeliveryDay: store.delivery_day, district: store.district }),
      )
    : null;

  const rules = rulesForPriceList(
    (discountRows as unknown as DiscountRule[] | null) ?? [],
    (store?.price_list_id as string | null) ?? null,
  );

  // product_id → what the store's catalog says today, so a cart saved
  // days ago gets re-priced, re-categorised (deals) and stock-checked.
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catalog: Record<string, CartProductInfo> | undefined = catalogRows
    ? Object.fromEntries(
        catalogRows.map((r) => {
          const cat = r.category_id ? catById.get(r.category_id) : undefined;
          return [
            r.product_id,
            {
              price: Number(r.effective_price) || 0,
              category_id: r.category_id ?? null,
              image_url: r.image_url ?? null,
              category_icon: categoryIconKey(cat ?? null),
              stock: Number(r.stock) || 0,
            } satisfies CartProductInfo,
          ];
        }),
      )
    : undefined;

  // Map product_id → { name, image_url } for bonus-row rendering.
  // Cart bonus lines show the actual product thumbnail + name so the
  // buyer recognises the free item visually instead of just by text.
  const bonusProductIds = Array.from(
    new Set(
      rules
        .filter((r) => r.kind === "threshold_bonus" && r.product_id)
        .map((r) => r.product_id as string),
    ),
  );
  let productInfoById: Record<string, { name: string; image_url: string | null }> = {};
  if (bonusProductIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, image_url")
      .in("id", bonusProductIds);
    productInfoById = Object.fromEntries(
      (prods ?? []).map((p) => [
        p.id as string,
        { name: p.name as string, image_url: (p.image_url as string | null) ?? null },
      ]),
    );
  }

  return (
    <CartView
      storeId={supermarketId}
      deliveryLabel={deliveryLabel}
      storeName={store?.name ?? null}
      rules={rules}
      productInfoById={productInfoById}
      catalog={catalog}
    />
  );
}
