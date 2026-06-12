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
    <header className="sticky top-0 z-10 h-14 glass-strong flex items-center gap-1 px-2 sm:px-4">
      {/* Brand-tinted hairline — matches the buyer/admin chrome. */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {backHref ? (
        <Link
          href={backHref}
          aria-label="Буцах"
          className="shrink-0 size-9 rounded-xl flex items-center justify-center bg-muted/60 hover:bg-muted ring-1 ring-border/60 hover:ring-border active:scale-95 transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => router.back()}
          className="shrink-0 size-9 rounded-xl flex items-center justify-center bg-muted/60 hover:bg-muted ring-1 ring-border/60 hover:ring-border active:scale-95 transition-all"
          aria-label="Буцах"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0 ml-1.5">
        <div className="text-sm font-bold leading-tight truncate">{title}</div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground leading-tight truncate">
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
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums flex items-center justify-center ring-2 ring-background">
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
