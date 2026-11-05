import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CartView } from "@/components/buyer/cart-view";
import {
  formatNextDeliveryLabel,
  resolveDeliveryDay,
} from "@/lib/delivery";
import { rulesForPriceList, type DiscountRule } from "@/lib/discount";
import { fetchAll } from "@/lib/supabase/fetch-all";

/**
 * Buyer cart route. Server component that resolves the delivery weekday
 * for the buyer's store + the currently-active discount rules, then
 * hands everything off to the client CartView (which owns the local
 * cart state + recomputes the breakdown live).
 */
export default async function CartPage() {
  const session = await requireSession();
  const supermarketId = session.profile.supermarket_id;
  const supabase = await createClient();

  let deliveryLabel: string | null = null;
  let storeName: string | null = null;
  let priceListId: string | null = null;

  // Store, deals and today's prices in one round trip. RLS already limits
  // discounts to active ones in their date window; rules not aimed at this
  // store's price list are dropped below (fix 30).
  const [{ data: store }, { data: discountRows }, priceRows] = await Promise.all([
    supermarketId
      ? supabase
          .from("supermarkets")
          .select("name, district, delivery_day, price_list_id")
          .eq("id", supermarketId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("discounts")
      .select(
        "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, ends_at, target_mode, target_price_list_ids",
      ),
    supermarketId
      ? fetchAll<{ product_id: string; effective_price: number }>(() =>
          supabase
            .from("supermarket_prices")
            .select("product_id, effective_price")
            .eq("supermarket_id", supermarketId)
            .order("product_id"),
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (store) {
    const day = resolveDeliveryDay({
      storeDeliveryDay: store.delivery_day,
      district: store.district,
    });
    deliveryLabel = formatNextDeliveryLabel(day);
    storeName = store.name;
    priceListId = (store.price_list_id as string | null) ?? null;
  }

  const rules = rulesForPriceList(
    (discountRows as unknown as DiscountRule[] | null) ?? [],
    priceListId,
  );
  // product_id → today's price, so a cart saved days ago gets re-priced.
  const prices = priceRows
    ? Object.fromEntries(priceRows.map((r) => [r.product_id, Number(r.effective_price) || 0]))
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
  let productInfoById: Record<
    string,
    { name: string; image_url: string | null }
  > = {};
  if (bonusProductIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, image_url")
      .in("id", bonusProductIds);
    productInfoById = Object.fromEntries(
      (prods ?? []).map((p) => [
        p.id as string,
        {
          name: p.name as string,
          image_url: (p.image_url as string | null) ?? null,
        },
      ]),
    );
  }

  return (
    <CartView
      deliveryLabel={deliveryLabel}
      storeName={storeName}
      rules={rules}
      productInfoById={productInfoById}
      prices={prices}
    />
  );
}
