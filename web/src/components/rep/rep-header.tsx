"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, ShoppingCart } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCart, totalQty, type CartScope } from "@/lib/cart";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
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
  const cart = useCart(cartScope);
  const qty = totalQty(cart);
  const router = useRouter();

  return (
    // Same blue brand bar as the store app.
    <header className="on-brand sticky top-0 z-10 h-14 bg-brand-bar text-brand-bar-foreground flex items-center gap-1 px-2 sm:px-4 shadow-[0_6px_18px_-12px_rgb(15_25_60/0.5)] [--badge-ring:var(--brand-bar)]">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Буцах"
          className="shrink-0 size-10 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/15 active:scale-95 transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => router.back()}
          className="shrink-0 size-10 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/15 active:scale-95 transition-all"
          aria-label="Буцах"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0 ml-1.5">
        <div className="text-[14px] font-bold leading-tight truncate text-white">{title}</div>
        {subtitle && (
          <div className="text-[11.5px] text-white/70 leading-tight truncate">
            {subtitle}
          </div>
        )}
      </div>

      {cartHref && (
        <Link
          href={cartHref}
          className="relative size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all"
          aria-label="Сагс"
        >
          <ShoppingCart className="h-5 w-5" />
          {qty > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-gold-foreground text-[10px] font-bold tabular-nums flex items-center justify-center ring-2 ring-[var(--badge-ring,var(--background))]">
              {qty}
            </span>
          )}
        </Link>
      )}

      <ThemeToggle variant="admin" />

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all"
          aria-label="Гарах"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </form>
    </header>
  );
}
