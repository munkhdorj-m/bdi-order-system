"use client";

import Link from "next/link";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/buyer/sign-out-button";
import { useCartLineCount, type CartScope } from "@/lib/cart";

type Props = {
  title: string;
  subtitle?: string;
  /** Where "Буцах" goes — always a real page (an installed app has no browser Back). */
  backHref: string;
  cartHref?: string;
  cartScope?: CartScope;
};

export function RepHeader({
  title,
  subtitle,
  backHref,
  cartHref,
  cartScope,
}: Props) {
  // Products in the cart (not pieces — a few boxes would read 288).
  const lines = useCartLineCount(cartScope);

  return (
    // Same blue brand bar as the store app.
    <header className="on-brand sticky top-0 z-10 h-14 bg-brand-bar text-brand-bar-foreground flex items-center gap-1 px-2 sm:px-4 [--badge-ring:var(--brand-bar)]">
      <Link
        href={backHref}
        aria-label="Буцах"
        className="shrink-0 size-10 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/15 active:scale-95 transition-all"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1 min-w-0 ml-1.5">
        <div className="text-[14px] font-bold leading-tight truncate text-white">{title}</div>
        {subtitle && (
          <div className="text-[12px] text-white/75 leading-tight truncate">
            {subtitle}
          </div>
        )}
      </div>

      {cartHref && (
        <Link
          href={cartHref}
          className="relative size-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all"
          aria-label={lines > 0 ? `Сагс: ${lines} бараа` : "Сагс"}
        >
          <ShoppingCart className="h-5 w-5" />
          {lines > 0 && (
            <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-gold-foreground text-[11px] font-bold tabular-nums flex items-center justify-center ring-2 ring-[var(--badge-ring,var(--background))]">
              {lines > 99 ? "99+" : lines}
            </span>
          )}
        </Link>
      )}

      <ThemeToggle variant="admin" />

      <SignOutButton />
    </header>
  );
}
