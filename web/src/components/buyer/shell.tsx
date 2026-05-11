"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ClipboardList, LogOut, ShoppingCart, Store } from "lucide-react";
import { useCart, totalQty } from "@/lib/cart";

type Props = {
  storeName: string;
  email: string | null;
  children: React.ReactNode;
};

export function BuyerShell({ storeName, email, children }: Props) {
  const cart = useCart();
  const qty = totalQty(cart);
  const pathname = usePathname();
  const router = useRouter();
  const showBack = pathname !== "/catalog";

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-10 h-14 border-b bg-background flex items-center px-3 sm:px-4">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-2 mr-1 p-2 rounded-md hover:bg-muted"
            aria-label="Буцах"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium truncate max-w-[40vw] sm:max-w-xs">
              {storeName}
            </span>
          </div>
        )}

        <Link
          href="/catalog"
          className="ml-auto mr-1 font-semibold tracking-tight"
        >
          BDI
        </Link>

        <Link
          href="/orders"
          className="ml-2 p-2 rounded-md hover:bg-muted"
          aria-label="Захиалга"
        >
          <ClipboardList className="h-5 w-5" />
        </Link>

        <Link
          href="/cart"
          className="ml-1 relative p-2 rounded-md hover:bg-muted"
          aria-label="Сагс"
        >
          <ShoppingCart className="h-5 w-5" />
          {qty > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
              {qty}
            </span>
          )}
        </Link>

        <form action="/auth/signout" method="post" className="ml-1">
          <button
            type="submit"
            className="p-2 rounded-md hover:bg-muted"
            aria-label="Гарах"
            title={email ?? "Гарах"}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
