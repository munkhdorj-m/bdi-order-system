import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/admin", label: "Дашбоард", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Захиалга", icon: ShoppingCart },
  { href: "/admin/products", label: "Бараа", icon: Package },
  { href: "/admin/supermarkets", label: "Дэлгүүр", icon: Store },
  { href: "/admin/users", label: "Хэрэглэгч", icon: Users },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
