"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, ShoppingCart } from "lucide-react";
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
    <header className="sticky top-0 z-10 h-14 border-b bg-background flex items-center px-3 sm:px-4">
      {backHref ? (
        <Link href={backHref} className="-ml-2 mr-1 p-2 rounded-md hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-2 mr-1 p-2 rounded-md hover:bg-muted"
          aria-label="Буцах"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-tight truncate">{title}</div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground leading-tight truncate">
            {subtitle}
          </div>
        )}
      </div>

      {cartHref && (
        <Link
          href={cartHref}
          className="ml-2 relative p-2 rounded-md hover:bg-muted"
          aria-label="Сагс"
        >
          <ShoppingCart className="h-5 w-5" />
          {qty > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
              {qty}
            </span>
          )}
        </Link>
      )}

      <form action="/auth/signout" method="post" className="ml-1">
        <button
          type="submit"
          className="p-2 rounded-md hover:bg-muted"
          aria-label="Гарах"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </form>
    </header>
  );
}
