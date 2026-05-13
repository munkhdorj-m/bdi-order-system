import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMnt } from "@/lib/format";
import {
  STATUS_COLOR,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  created_at: string;
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
