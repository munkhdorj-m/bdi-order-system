import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

  const stats = [
    {
      label: "Шинэ захиалга",
      value: pendingCount ?? 0,
      href: "/admin/orders?status=pending",
      accent: (pendingCount ?? 0) > 0,
    },
    {
      label: "Идэвхтэй захиалга",
      value: activeCount ?? 0,
      href: "/admin/orders?status=active",
    },
    { label: "Бараа", value: productCount ?? 0, href: "/admin/products" },
    { label: "Дэлгүүр", value: supermarketCount ?? 0, href: "/admin/supermarkets" },
  ];

  const recentOrders = (recent as unknown as RecentOrder[]) ?? [];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Дашбоард</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card
              className={
                s.accent
                  ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 hover:shadow-sm transition-shadow"
                  : "hover:shadow-sm transition-shadow"
              }
            >
              <CardHeader className="pb-2">
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl">{s.value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
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
                    <div className="text-xs text-muted-foreground mt-0.5">
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
