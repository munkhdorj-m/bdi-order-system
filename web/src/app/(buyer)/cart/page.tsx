import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CartView } from "@/components/buyer/cart-view";
import {
  formatNextDeliveryLabel,
  resolveDeliveryDay,
} from "@/lib/delivery";
import type { DiscountRule } from "@/lib/discount";

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

  if (supermarketId) {
    const { data: store } = await supabase
      .from("supermarkets")
      .select("name, district, delivery_day")
      .eq("id", supermarketId)
      .maybeSingle();
    if (store) {
      const day = resolveDeliveryDay({
        storeDeliveryDay: store.delivery_day,
        district: store.district,
      });
      deliveryLabel = formatNextDeliveryLabel(day);
      storeName = store.name;
    }
  }

  // Pull active rules so the cart can itemize each discount. RLS
  // already filters by active=true + starts_at/ends_at window.
  const { data: discountRows } = await supabase
    .from("discounts")
    .select(
      "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, ends_at",
    );
  const rules = (discountRows as unknown as DiscountRule[] | null) ?? [];

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
    />
  );
}
