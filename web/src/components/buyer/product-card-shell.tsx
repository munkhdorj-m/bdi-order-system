"use client";

import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

/**
 * Outer wrapper for the catalog ProductCard. Lives in its own tiny client
 * component so the server-rendered card can subscribe to cart state — when
 * the buyer has the product in their cart, the card gets a brand-tinted
 * background + primary ring + soft shadow as a passive visual cue ("I've
 * got that one already"). Matches the Hi-Fi "Confident" card pattern.
 */
export function ProductCardShell({
  productId,
  children,
  style,
}: {
  productId: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const cart = useCart();
  const inCart = cart.some((i) => i.product_id === productId);

  return (
    <div
      data-in-cart={inCart || undefined}
      style={style}
      className={cn(
        "catalog-card-enter group relative flex flex-col rounded-3xl overflow-hidden transition-all duration-300 ease-out",
        "bg-card ring-1 ring-border",
        // In-cart highlight — tinted bg, brand ring, soft brand-shadow.
        "data-[in-cart]:bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))]",
        "data-[in-cart]:ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]",
        "data-[in-cart]:shadow-md data-[in-cart]:shadow-[color-mix(in_oklch,var(--primary)_15%,transparent)]",
        // Desktop hover lift.
        "md:hover:shadow-lg md:hover:shadow-foreground/5 md:hover:-translate-y-0.5",
      )}
    >
      {children}
    </div>
  );
}
