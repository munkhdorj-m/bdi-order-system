"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { syncCartPrices } from "@/lib/cart";

/**
 * On opening a cart: apply the store's current prices to it and say what
 * changed, so the total shown is the total the order will have.
 */
export function useCartPriceSync(prices: Record<string, number> | undefined, storeId?: string) {
  useEffect(() => {
    if (!prices) return;
    const { repriced, removed } = syncCartPrices(prices, storeId ? { storeId } : undefined);
    if (removed.length > 0) {
      toast.warning(
        removed.length === 1
          ? `«${removed[0]}» одоо зарагдахгүй байгаа тул сагснаас хасагдлаа`
          : `${removed.length} бараа одоо зарагдахгүй байгаа тул сагснаас хасагдлаа`,
      );
    }
    if (repriced > 0) toast.info(`${repriced} барааны үнэ өөрчлөгдсөн — шинэ үнээр тооцлоо`);
  }, [prices, storeId]);
}
