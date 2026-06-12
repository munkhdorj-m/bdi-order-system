import Link from "next/link";
import {
  ArrowRight,
  Bell,
  ClipboardList,
  Package,
  Store as StoreIcon,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { QuickAdvanceButton } from "@/components/admin/quick-advance-button";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { formatMnt } from "@/lib/format";

type PendingOrder = {
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
  value: number | string;
  sub?: string;
  href: string;
  icon: LucideIcon;
  /** Token used for the colored ring + icon tint. */
  tone: "amber" | "primary" | "violet" | "sky";
  /** Highlight if this stat needs attention (e.g. pending orders > 0). */
  alert?: boolean;
};

// Per-tone color recipes for the stat cards' icon tile + alert ring.
const TONE_STYLE: Record<
  Stat["tone"],
  { icon: string; alertRing: string }
> = {
  amber: {
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
    alertRing: "ring-[color-mix(in_oklch,var(--chart-amber)_30%,transparent)]",
  },
  primary: {
    icon: "bg-[color-mix(in_oklch,var(--primary)_15%,var(--card))] text-primary",
    alertRing: "ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]",
  },
  violet: {
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
    alertRing: "ring-violet-200/60 dark:ring-violet-900/60",
  },
  sky: {
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
    alertRing: "ring-sky-200/60 dark:ring-sky-900/60",
  },
};

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: productCount },
    { count: supermarketCount },
    { count: pendingCount },
    { count: activeCount },
    { count: pendingUsersCount },
    { data: pendingOrders },
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
    // Users awaiting admin approval. Surfaced as a banner at the top of
    // the dashboard so a new signup never quietly stays locked out.
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("active", false),
    // Pending queue — newest first. Capped to 6 per design; the "Бүгд"
    // link sends the admin to the full filtered list.
    supabase
      .from("orders")
      .select(
        "id, order_number, status, subtotal, created_at, supermarkets:supermarket_id(name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const pendingUsers = pendingUsersCount ?? 0;

  const stats: Stat[] = [
    {
      label: "Шинэ захиалга",
      value: pendingCount ?? 0,
      sub: pendingCount ? `${pendingCount} хүлээгдсээр` : "Хүлээгдэх алга",
      href: "/admin/orders?status=pending",
      icon: Bell,
      tone: "amber",
      alert: (pendingCount ?? 0) > 0,
    },
    {
      label: "Идэвхтэй захиалга",
      value: activeCount ?? 0,
      sub: "Шинэ + багцлаж + илгээсэн",
      href: "/admin/orders?status=active",
      icon: ClipboardList,
      tone: "primary",
    },
    {
      label: "Бараа",
      value: productCount ?? 0,
      sub: "Идэвхтэй SKU",
      href: "/admin/products",
      icon: Package,
      tone: "violet",
    },
    {
      label: "Дэлгүүр",
      value: supermarketCount ?? 0,
      sub: "Хариуцагчтай",
      href: "/admin/supermarkets",
      icon: StoreIcon,
      tone: "sky",
    },
  ];

  const rows = (pendingOrders as unknown as PendingOrder[]) ?? [];

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Дашбоард</h1>
          <p className="text-[13px] text-muted-foreground">
            Өнөөдөр ·{" "}
            {new Date().toLocaleDateString("mn-MN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Pending-users banner — only renders when there's a queue. Clicking
          the row navigates to the /admin/users?role=pending filtered list
          where the admin can approve each row inline. */}
      {pendingUsers > 0 && (
        <Link
          href="/admin/users?role=pending"
          className="group mb-4 block rounded-2xl bg-amber-50 ring-1 ring-amber-200 hover:ring-amber-300 px-4 py-3 transition-all dark:bg-amber-950/30 dark:ring-amber-800/60 dark:hover:ring-amber-700/80"
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200 flex items-center justify-center shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-amber-900 dark:text-amber-100">
                {pendingUsers} шинэ хэрэглэгч баталгаажилт хүлээж байна
              </div>
              <div className="text-[12px] text-amber-800/80 dark:text-amber-200/70">
                Зөвшөөрөл өгөхгүй бол тэд нэвтэрч чадахгүй.
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-700 dark:text-amber-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </Link>
      )}

      {/* Stat cards — Hi-Fi tone-mapped grid. Big 28px value, icon tile
          top-left, alert dot top-right when this card needs attention. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          const tone = TONE_STYLE[s.tone];
          return (
            <Link key={s.label} href={s.href} className="block">
              <Card
                className={`group relative transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${
                  s.alert ? `ring-1 ${tone.alertRing}` : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center ${tone.icon}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {s.alert && (
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>
                  <div className="mt-3 text-[28px] font-bold tabular-nums tracking-tight leading-none">
                    {typeof s.value === "number"
                      ? s.value.toLocaleString("mn-MN")
                      : s.value}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground mt-1.5">
                    {s.label}
                  </div>
                  {s.sub && (
                    <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                      {s.sub}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Pending queue — action-first list. Hi-Fi pattern: each row has a
          "Үзэх" link to the detail page where the admin can confirm or
          cancel. Direct inline confirm without leaving the dashboard is a
          follow-up (needs a server action wired in).  */}
      <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
          <h2 className="text-[15px] font-bold tracking-tight">
            Хүлээгдэж буй захиалга
          </h2>
          {(pendingCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 ring-1 ring-amber-300/60 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800/60">
              <span className="size-1.5 rounded-full bg-amber-500" />{" "}
              {pendingCount}
            </span>
          )}
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/admin/orders?status=pending">
              Бүгд
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Хүлээгдэж буй захиалга алга байна.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((o) => (
              <div
                key={o.id}
                className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="leading-tight min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-mono font-semibold">
                      {o.order_number}
                    </span>
                    <OrderStatusPill status={o.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {o.supermarkets?.name ?? "—"} ·{" "}
                    {formatRelative(o.created_at)}
                  </div>
                </div>
                <div className="ml-auto text-[14px] font-bold tabular-nums w-24 text-right">
                  {formatMnt(o.subtotal)}
                </div>
                {/* Confirm without leaving the dashboard — detail page is
                    still one click away for anything more involved. */}
                <QuickAdvanceButton orderId={o.id} status={o.status} />
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/orders/${o.id}`}>Үзэх</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
