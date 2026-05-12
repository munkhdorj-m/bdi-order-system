import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { type OrderStatus } from "@/lib/order-status";
import { RepHeader } from "@/components/rep/rep-header";
import { formatMnt } from "@/lib/format";

type Params = Promise<{ id: string }>;

type Store = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function RepStoreDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: store }, { data: orders }] = await Promise.all([
    supabase
      .from("supermarkets")
      .select("id, name, address, contact_phone")
      .eq("id", id)
      .single(),
    supabase
      .from("orders")
      .select("id, order_number, status, subtotal, created_at")
      .eq("supermarket_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!store) notFound();
  const s = store as Store;
  const rows = (orders as OrderRow[] | null) ?? [];

  return (
    <div>
      <RepHeader
        title={s.name}
        subtitle={s.contact_phone ?? undefined}
        backHref="/rep"
        cartHref={`/rep/stores/${id}/cart`}
        cartScope={{ storeId: id }}
      />

      <main className="px-3 sm:px-4 py-4 max-w-2xl mx-auto">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">Дэлгүүрийн мэдээлэл</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {s.address && <div>{s.address}</div>}
            {s.contact_phone && (
              <div className="font-mono text-xs text-muted-foreground">
                {s.contact_phone}
              </div>
            )}
          </CardContent>
        </Card>

        <Button asChild className="w-full h-12 rounded-full mb-4">
          <Link href={`/rep/stores/${id}/catalog`}>
            <ShoppingBag className="h-4 w-4" />
            Захиалга үүсгэх
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Сүүлийн захиалгууд</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Захиалга байхгүй байна.
              </div>
            ) : (
              <div className="divide-y">
                {rows.map((o) => (
                  <Link
                    key={o.id}
                    href={`/rep/orders/${o.id}`}
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
                        {formatDate(o.created_at)}
                      </div>
                    </div>
                    <div className="text-sm font-medium shrink-0">
                      {formatMnt(o.subtotal)}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
