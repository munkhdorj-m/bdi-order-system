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
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
      aria-label="Үндсэн цэс"
    >
      <ul className="flex min-h-14 max-w-lg mx-auto">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center h-full gap-1 py-2 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  {typeof t.badge === "number" && t.badge > 0 && (
                    <span
                      className={cn(
                        "absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums flex items-center justify-center ring-2 ring-background",
                        bounce && "animate-cart-bounce",
                      )}
                      aria-label={`Сагсанд ${t.badge} ширхэг`}
                    >
                      {t.badge > 99 ? "99+" : t.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10.5px] font-medium leading-none">
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
