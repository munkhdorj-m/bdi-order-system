import Link from "next/link";
import {
  ArrowRight,
  Bell,
  ClipboardList,
  Package,
  Store as StoreIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { formatMnt } from "@/lib/format";

type RecentOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  created_at: string;
  supermarkets: { name: string } | null;
};

function formatRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "одоо";
  if (min < 60) return `${min} мин өмнө`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} цаг өмнө`;
  const day = Math.floor(hr / 24);
  return `${day} өдрийн өмнө`;
}

type Stat = {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  /** Token used for the colored ring + icon tint. */
  tone: "amber" | "primary" | "violet" | "sky";
  /** Highlight if this stat needs attention (e.g. pending orders > 0). */
  alert?: boolean;
};

const TONE_STYLE: Record<
  Stat["tone"],
  { icon: string; ring: string; alertBg: string }
> = {
  amber: {
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    ring: "ring-amber-200/60 dark:ring-amber-900/60",
    alertBg: "from-amber-50/80 via-background to-background dark:from-amber-950/30",
  },
  primary: {
    icon: "bg-primary/15 text-primary",
    ring: "ring-primary/20",
    alertBg: "from-primary/10 via-background to-background",
  },
  violet: {
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
    ring: "ring-violet-200/60 dark:ring-violet-900/60",
    alertBg: "from-violet-50/80 via-background to-background dark:from-violet-950/30",
  },
  sky: {
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
    ring: "ring-sky-200/60 dark:ring-sky-900/60",
    alertBg: "from-sky-50/80 via-background to-background dark:from-sky-950/30",
  },
};

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: productCount },
    { count: supermarketCount },
    { count: pendingCount },
    { count: activeCount },
    { data: recent },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("supermarkets").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ACTIVE_STATUSES),
    supabase
      .from("orders")
      .select(
        "id, order_number, status, subtotal, created_at, supermarkets:supermarket_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const stats: Stat[] = [
    {
      label: "Шинэ захиалга",
      value: pendingCount ?? 0,
      href: "/admin/orders?status=pending",
      icon: Bell,
      tone: "amber",
      alert: (pendingCount ?? 0) > 0,
    },
    {
      label: "Идэвхтэй захиалга",
      value: activeCount ?? 0,
      href: "/admin/orders?status=active",
      icon: ClipboardList,
      tone: "violet",
    },
    {
      label: "Бараа",
      value: productCount ?? 0,
      href: "/admin/products",
      icon: Package,
      tone: "primary",
    },
    {
      label: "Дэлгүүр",
      value: supermarketCount ?? 0,
      href: "/admin/supermarkets",
      icon: StoreIcon,
      tone: "sky",
    },
  ];

  const recentOrders = (recent as unknown as RecentOrder[]) ?? [];

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Дашбоард</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          const tone = TONE_STYLE[s.tone];
          return (
            <Link key={s.label} href={s.href}>
              <Card
                className={`group relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${
                  s.alert
                    ? `bg-gradient-to-br ${tone.alertBg} ring-1 ${tone.ring}`
                    : ""
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`size-9 rounded-lg flex items-center justify-center ${tone.icon}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {s.alert && (
                      <span className="inline-flex size-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight">
                    {s.value.toLocaleString("mn-MN")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.label}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Сүүлийн захиалгууд</CardTitle>
            <CardDescription>
              Хамгийн сүүлийн {recentOrders.length} захиалга
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/orders">
              Бүгд
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Захиалга байхгүй байна.
            </div>
          ) : (
            <div className="divide-y">
              {recentOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">
                        {o.order_number}
                      </span>
                      <OrderStatusPill status={o.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {o.supermarkets?.name ?? "—"} · {formatRelative(o.created_at)}
                    </div>
                  </div>
                  <div className="text-sm font-medium shrink-0">
                    {formatMnt(o.subtotal)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
