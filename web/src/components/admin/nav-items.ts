import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavSection = {
  /** Optional heading shown above the items. Omit for the first/top group. */
  label?: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    items: [{ href: "/admin", label: "Дашбоард", icon: LayoutDashboard }],
  },
  {
    label: "Үйл ажиллагаа",
    items: [{ href: "/admin/orders", label: "Захиалга", icon: ShoppingCart }],
  },
  {
    label: "Каталог",
    items: [
      { href: "/admin/products", label: "Бараа", icon: Package },
      { href: "/admin/price-lists", label: "Үнийн жагсаалт", icon: Tags },
    ],
  },
  {
    label: "Тохиргоо",
    items: [
      { href: "/admin/supermarkets", label: "Дэлгүүр", icon: Store },
      { href: "/admin/users", label: "Хэрэглэгч", icon: Users },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
