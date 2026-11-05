"use client";

import Link from "next/link";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { totalAmount, totalQty, useCart, type CartScope } from "@/lib/cart";
import { formatMnt } from "@/lib/format";
import { computeDiscount, type DiscountRule } from "@/lib/discount";
import { cn } from "@/lib/utils";

/**
 * Floating "what's in my cart" bar for the catalog: appears once something
 * is added, shows how much, and takes you to the cart in one tap — no need
 * to hunt for the cart tab while ordering. With the store's deals the
 * total matches the cart (credit payment; cash adds its own discount).
 */
export function CartBar({
  href,
  scope,
  aboveTabBar = false,
  rules,
}: {
  href: string;
  scope?: CartScope;
  /** Store app: sit above the fixed bottom tab bar (h-14). */
  aboveTabBar?: boolean;
  /** Active deals for this store, so the total matches the cart. */
  rules?: DiscountRule[];
}) {
  const cart = useCart(scope);
  const lines = cart.length;
  if (lines === 0) return null;
  const pieces = totalQty(cart);
  const total =
    rules && rules.length > 0
      ? computeDiscount(
          cart.map((c) => ({ product_id: c.product_id, qty: c.qty, unit_price: c.unit_price, category_id: c.category_id ?? null })),
          "credit",
          rules,
        ).net
      : totalAmount(cart);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[15] px-3 sm:px-4",
        aboveTabBar ? "bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)]" : "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]",
      )}
    >
      <Link
        href={href}
        className="pointer-events-auto mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-primary py-2.5 pl-2.5 pr-4 text-primary-foreground shadow-xl shadow-primary/30 ring-1 ring-black/5 transition-transform duration-150 animate-in fade-in slide-in-from-bottom-3 active:scale-[0.98]"
        aria-label={`Сагс: ${lines} бараа, ${formatMnt(total)}`}
      >
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <ShoppingCart className="h-5 w-5" />
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold tabular-nums text-gold-foreground ring-2 ring-primary">
            {lines}
          </span>
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11.5px] text-white/75">
            {lines} төрөл · {pieces} ширхэг
          </span>
          <span className="block font-display text-[16px] font-semibold tabular-nums">{formatMnt(total)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold">
          Сагс
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}
