import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import {
  ACTIVE_STATUSES,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { formatMnt } from "@/lib/format";

type SearchParams = Promise<{ status?: string }>;

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  created_at: string;
  supermarkets: { name: string } | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, created_at, supermarkets:supermarket_id(name)",
    )
    .order("created_at", { ascending: false });

  if (status === "active") {
    query = query.in("status", ACTIVE_STATUSES);
  } else if (
    status &&
    (
      ["pending", "confirmed", "packing", "shipped", "delivered", "cancelled"] as const
    ).includes(status as OrderStatus)
  ) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  const rows = (data as unknown as OrderRow[]) ?? [];

  const tabs: { key: string | null; label: string }[] = [
    { key: null, label: "Бүгд" },
    { key: "active", label: "Идэвхтэй" },
    { key: "pending", label: STATUS_LABELS.pending },
    { key: "confirmed", label: STATUS_LABELS.confirmed },
    { key: "packing", label: STATUS_LABELS.packing },
    { key: "shipped", label: STATUS_LABELS.shipped },
    { key: "delivered", label: STATUS_LABELS.delivered },
    { key: "cancelled", label: STATUS_LABELS.cancelled },
  ];

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Захиалга</h1>
        <p className="text-sm text-muted-foreground mt-1">Нийт {rows.length}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => {
          const active =
            (t.key === null && !status) || t.key === status;
          const href = t.key ? `/admin/orders?status=${t.key}` : "/admin/orders";
          return (
            <Link
              key={t.label}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      <Card>
        {rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>Захиалга алга байна.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дугаар</TableHead>
                <TableHead>Дэлгүүр</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Дүн</TableHead>
                <TableHead>Огноо</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.supermarkets?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <OrderStatusPill status={o.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMnt(o.subtotal)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(o.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
