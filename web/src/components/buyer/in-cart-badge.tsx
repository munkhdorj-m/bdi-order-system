"use client";

import { useCart } from "@/lib/cart";

/**
 * Small qty pill that sits on the product image's top-right when the product
 * is already in the buyer's cart. Returns null otherwise so it costs nothing
 * visually (and won't disrupt layout) for fresh products.
 */
export function InCartBadge({ productId }: { productId: string }) {
  const cart = useCart();
  const qty = cart.find((i) => i.product_id === productId)?.qty ?? 0;
  if (qty === 0) return null;

  return (
    <div
      key={qty}
      className="absolute top-2 right-2 z-10 min-w-6 h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tabular-nums flex items-center justify-center shadow-md ring-2 ring-card animate-in fade-in zoom-in-50 duration-300"
      aria-label={`Сагсанд ${qty} ширхэг`}
    >
      {qty}
    </div>
  );
}
