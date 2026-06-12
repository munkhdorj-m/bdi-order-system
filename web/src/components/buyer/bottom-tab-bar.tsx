"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ShoppingBag, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, totalQty } from "@/lib/cart";

export function BuyerBottomTabBar() {
  const pathname = usePathname();
  const cart = useCart();
  const cartQty = totalQty(cart);
  const [bounce, setBounce] = useState(false);
  const prevQtyRef = useRef(cartQty);

  useEffect(() => {
    if (cartQty > prevQtyRef.current) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 450);
      prevQtyRef.current = cartQty;
      return () => clearTimeout(t);
    }
    prevQtyRef.current = cartQty;
  }, [cartQty]);

  const tabs = [
    {
      href: "/catalog",
      label: "Каталог",
      icon: ShoppingBag,
      match: (p: string) => p === "/catalog" || p.startsWith("/catalog/"),
    },
    {
      href: "/orders",
      label: "Захиалга",
      icon: ClipboardList,
      match: (p: string) => p === "/orders" || p.startsWith("/orders/"),
    },
    {
      href: "/cart",
      label: "Сагс",
      icon: ShoppingCart,
      match: (p: string) => p === "/cart",
      badge: cartQty,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 glass-strong pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.15)]"
      aria-label="Үндсэн цэс"
    >
      {/* Brand-tinted hairline — mirrors the header's bottom hairline so
          the two chrome bars read as a matched pair framing the content. */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Material-style navigation bar: labels stay visible on EVERY tab
          (recognition beats recall — buyers shouldn't have to decode bare
          icons), and the active tab's icon sits in a filled brand capsule
          so "where am I" is answerable at a glance. Bar stays h-14 — the
          product/cart/order sticky bars offset against that height. */}
      <ul className="flex min-h-14 max-w-lg mx-auto px-2">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center justify-center h-full gap-1 py-1.5 group active:scale-95 transition-transform"
              >
                <span
                  className={cn(
                    "relative flex items-center justify-center h-7 w-12 rounded-full transition-all duration-300 ease-out",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground group-hover:bg-muted/70 group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
                  {typeof t.badge === "number" && t.badge > 0 && (
                    <span
                      className={cn(
                        "absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center ring-2 ring-background",
                        active
                          ? "bg-foreground text-background"
                          : "bg-primary text-primary-foreground",
                        bounce && "animate-cart-bounce",
                      )}
                      aria-label={`Сагсанд ${t.badge} ширхэг`}
                    >
                      {t.badge > 99 ? "99+" : t.badge}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[10.5px] leading-none transition-colors",
                    active
                      ? "text-primary font-bold"
                      : "text-muted-foreground font-medium group-hover:text-foreground",
                  )}
                >
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
