import {
  BarChart3,
  ClipboardList,
  Database,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  Store,
  Tags,
  Truck,
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
    items: [
      { href: "/admin/orders", label: "Захиалга", icon: ShoppingCart },
      { href: "/admin/analytics", label: "Аналитик", icon: BarChart3 },
    ],
  },
  {
    label: "Хүргэлт",
    items: [
      { href: "/admin/dispatch", label: "Хүргэлт хуваарлах", icon: Truck },
      { href: "/admin/shipments", label: "Ачилтын жагсаалт", icon: ClipboardList },
      { href: "/admin/ebarimt", label: "Е-баримт", icon: Receipt },
    ],
  },
  {
    label: "Каталог",
    items: [
      { href: "/admin/products", label: "Бараа", icon: Package },
      { href: "/admin/categories", label: "Ангилал", icon: LayoutGrid },
      { href: "/admin/price-lists", label: "Үнийн жагсаалт", icon: Tags },
      { href: "/admin/discounts", label: "Хямдрал", icon: Percent },
    ],
  },
  {
    label: "Тохиргоо",
    items: [
      { href: "/admin/supermarkets", label: "Дэлгүүр", icon: Store },
      { href: "/admin/users", label: "Хэрэглэгч", icon: Users },
    ],
  },
  {
    label: "Шилжилт",
    items: [{ href: "/admin/mercury", label: "Mercury-гаас шилжих", icon: Database }],
  },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
