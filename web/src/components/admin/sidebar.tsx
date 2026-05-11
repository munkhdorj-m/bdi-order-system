"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Дашбоард", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Захиалга", icon: ShoppingCart },
  { href: "/admin/products", label: "Бараа", icon: Package },
  { href: "/admin/supermarkets", label: "Дэлгүүр", icon: Store },
  { href: "/admin/users", label: "Хэрэглэгч", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="h-14 flex items-center px-5 border-b">
        <Link href="/admin" className="font-semibold tracking-tight">
          BDI Admin
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
