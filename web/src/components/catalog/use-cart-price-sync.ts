"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { adoptLegacyCart, syncCart, type CartProductInfo, type CartScope } from "@/lib/cart";

/**
 * On opening a cart: bring it in line with the store's catalog today —
 * price, category (deals match on it), photo — and say what changed, so
 * the total shown is the total the order will have.
 */
export function useCartPriceSync(
  catalog: Record<string, CartProductInfo> | undefined,
  scope: CartScope,
) {
  const { storeId, owner } = scope;
  useEffect(() => {
    // No catalog, or an empty one, means it couldn't be loaded — a store
    // with nothing for sale isn't a thing. Don't empty the cart over it.
    if (!catalog || Object.keys(catalog).length === 0) return;
    const s: CartScope = { storeId, owner };
    // A store's cart from before carts were kept per shop.
    if (owner === "buyer") adoptLegacyCart(s);
    const { repriced, removed } = syncCart(catalog, s);
    if (removed.length > 0) {
      toast.warning(
        removed.length === 1
          ? `«${removed[0]}» одоо зарагдахгүй байгаа тул сагснаас хасагдлаа`
          : `${removed.length} бараа одоо зарагдахгүй байгаа тул сагснаас хасагдлаа`,
      );
    }
    if (repriced > 0) toast.info(`${repriced} барааны үнэ өөрчлөгдсөн — шинэ үнээр тооцлоо`);
  }, [catalog, storeId, owner]);
}
