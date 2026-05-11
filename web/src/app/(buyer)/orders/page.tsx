import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMnt } from "@/lib/cart";

type OrderRow = {
  id: string;
  order_number: string;
  status: "pending" | "confirmed" | "packing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  created_at: string;
};

const STATUS_LABELS: Record<OrderRow["status"], string> = {
  pending: "Хүлээгдэж буй",
  confirmed: "Баталгаажсан",
  packing: "Багцлаж буй",
  shipped: "Илгээсэн",
  delivered: "Хүргэгдсэн",
  cancelled: "Цуцлагдсан",
};

const STATUS_COLOR: Record<OrderRow["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  packing: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  shipped: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  delivered:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function BuyerOrdersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, subtotal, created_at")
    .order("created_at", { ascending: false });

  const rows = (data as OrderRow[] | null) ?? [];

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Миний захиалгууд</h1>

      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Захиалга байхгүй байна.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="block bg-background border rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium">
                      {o.order_number}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[o.status]}`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDate(o.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {formatMnt(o.subtotal)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
