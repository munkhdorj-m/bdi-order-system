"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

/**
 * The store page's main button: start an order — or, when this phone
 * already holds an unsent cart for the store, finish that one.
 */
export function RepStoreCta({ storeId }: { storeId: string }) {
  const scope = useMemo(() => ({ storeId }), [storeId]);
  const cart = useCart(scope);
  const catalog = `/rep/stores/${storeId}/catalog`;

  if (cart.length > 0) {
    return (
      <div className="mt-3 flex gap-2">
        <Button asChild variant="gold" size="lg" className="h-14 flex-1 rounded-2xl text-[15px]">
          <Link href={`/rep/stores/${storeId}/cart`}>
            <ShoppingCart className="size-5" />
            Сагс · {cart.length} бараа — илгээх
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-14 rounded-2xl px-4">
          <Link href={catalog} aria-label="Бараа нэмэх">
            <Plus className="size-5" />
            Нэмэх
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <Button asChild variant="gold" size="lg" className="mt-3 h-14 w-full rounded-2xl text-[15px]">
      <Link href={catalog}>
        <ShoppingCart className="size-5" />
        Захиалга авах
      </Link>
    </Button>
  );
}
