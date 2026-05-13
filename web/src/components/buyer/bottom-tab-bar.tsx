"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ShoppingBag, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, totalQty } from "@/lib/cart";

type Tab = {
  href: string;
  label: string;
  icon: typeof ShoppingBag;
  match: (path: string) => boolean;
  badge?: number;
};

export function BuyerBottomTabBar() {
  const pathname = usePathname();
  const cart = useCart();
  const cartQty = totalQty(cart);

  const tabs: Tab[] = [
    {
      href: "/catalog",
      label: "Каталог",
      icon: ShoppingBag,
      match: (p) => p === "/catalog" || p.startsWith("/catalog/"),
    },
    {
      href: "/orders",
      label: "Захиалга",
      icon: ClipboardList,
      match: (p) => p === "/orders" || p.startsWith("/orders/"),
    },
    {
      href: "/cart",
      label: "Сагс",
      icon: ShoppingCart,
      match: (p) => p === "/cart",
      badge: cartQty,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
      aria-label="Үндсэн цэс"
    >
      <ul className="flex">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 px-2 transition-colors relative",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {typeof t.badge === "number" && t.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
