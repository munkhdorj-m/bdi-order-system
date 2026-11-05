import Link from "next/link";
import { FileSpreadsheet, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addDays,
  formatDateTimeUb,
  isIsoDay,
  SHIPMENT_STATUS_LABELS,
  splitBoxes,
  todayUb,
  type ShipmentStatus,
} from "@/lib/dispatch";
import { formatMnt } from "@/lib/format";

type SearchParams = Promise<{ from?: string; to?: string }>;

type ShipmentRow = {
  id: string;
  shipment_no: number;
  delivery_date: string;
  status: ShipmentStatus;
  created_at: string;
  closed_at: string | null;
  distributor: { name: string; phone: string | null } | null;
  closedBy: { full_name: string | null } | null;
};

type OrderAgg = {
  shipment_id: string;
  subtotal: number;
  discount_total: number | null;
  items: { qty: number; product: { box_count: number | null } | null }[];
};

/**
 * Ачилтын жагсаалт — Mercury's "Хаасан захиалгын жагсаалт": every delivery
 * run in a date range with its totals, documents and Excel.
 */
export default async function ShipmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayUb();
  const to = isIsoDay(sp.to) ? sp.to : addDays(today, 1);
  const from = isIsoDay(sp.from) ? sp.from : addDays(today, -7);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, shipment_no, delivery_date, status, created_at, closed_at, distributor:distributor_id(name, phone), closedBy:closed_by(full_name)",
    )
    .gte("delivery_date", from)
    .lte("delivery_date", to)
    .order("delivery_date", { ascending: false })
    .order("shipment_no", { ascending: false });

  const shipments = (data ?? []) as unknown as ShipmentRow[];
  const ids = shipments.map((s) => s.id);
  const { data: orderData } = ids.length
    ? await supabase
        .from("orders")
        .select("shipment_id, subtotal, discount_total, items:order_items(qty, product:product_id(box_count))")
        .in("shipment_id", ids)
        .neq("status", "cancelled")
    : { data: [] };

  const agg = new Map<string, { orders: number; amount: number; pieces: number; boxes: number }>();
  for (const o of (orderData ?? []) as unknown as OrderAgg[]) {
    const a = agg.get(o.shipment_id) ?? { orders: 0, amount: 0, pieces: 0, boxes: 0 };
    a.orders += 1;
    a.amount += Math.max(0, Number(o.subtotal) - Number(o.discount_total ?? 0));
    for (const i of o.items ?? []) {
      a.pieces += i.qty;
      a.boxes += splitBoxes(i.qty, i.product?.box_count).boxes;
    }
    agg.set(o.shipment_id, a);
  }
  const totals = [...agg.values()].reduce(
    (t, a) => ({ orders: t.orders + a.orders, amount: t.amount + a.amount, pieces: t.pieces + a.pieces, boxes: t.boxes + a.boxes }),
    { orders: 0, amount: 0, pieces: 0, boxes: 0 },
  );

  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Ачилтын жагсаалт</h1>
          <p className="text-[13px] text-muted-foreground">Хүргэлтийн ачилтууд, падаан, нэгтгэл, Excel.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/dispatch">Хүргэлт хуваарлах</Link>
        </Button>
      </div>

      <Card className="p-3 mb-4">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-[12px] text-muted-foreground">
            Эхлэх
            <input type="date" name="from" defaultValue={from} className="input-field mt-1 h-9 w-40 block" />
          </label>
          <label className="text-[12px] text-muted-foreground">
            Дуусах
            <input type="date" name="to" defaultValue={to} className="input-field mt-1 h-9 w-40 block" />
          </label>
          <Button type="submit" size="sm" className="h-9">
            Харах
          </Button>
        </form>
      </Card>

      {error ? (
        <Card className="p-6 text-sm">
          <div className="font-medium mb-1">Ачилтын хүснэгт бэлэн биш байна.</div>
          <p className="text-muted-foreground">
            Supabase SQL Editor дээр <code>docs/fixes/37-dispatch-and-ebarimt.sql</code>-ийг ажиллуулна уу.
          </p>
          <p className="text-muted-foreground mt-2 break-words">Алдаа: {error.message}</p>
        </Card>
      ) : shipments.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Энэ хугацаанд ачилт алга.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ачилт №</TableHead>
                <TableHead>Хүргэх өдөр</TableHead>
                <TableHead>Түгээгч</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead className="text-right">Захиалга</TableHead>
                <TableHead className="text-right">Хайрцаг</TableHead>
                <TableHead className="text-right">Ширхэг</TableHead>
                <TableHead className="text-right">Дүн</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => {
                const a = agg.get(s.id) ?? { orders: 0, amount: 0, pieces: 0, boxes: 0 };
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/admin/dispatch?date=${s.delivery_date}&shipment=${s.id}`}
                        className="font-semibold hover:underline"
                      >
                        №{s.shipment_no}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{s.delivery_date}</TableCell>
                    <TableCell>
                      {s.distributor ? `${s.distributor.name}${s.distributor.phone ? ` ${s.distributor.phone}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-[12.5px]">
                      {SHIPMENT_STATUS_LABELS[s.status]}
                      {s.closed_at && (
                        <div className="text-muted-foreground tabular-nums">
                          {formatDateTimeUb(s.closed_at)}
                          {s.closedBy?.full_name ? ` · ${s.closedBy.full_name}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.boxes}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.pieces}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatMnt(a.amount)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" title="Падаан хэвлэх">
                          <a href={`/print/invoices?shipment=${s.id}`} target="_blank" rel="noreferrer">
                            <Printer className="h-4 w-4" />
                            Падаан
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="ghost" title="Нэгтгэл хэвлэх">
                          <a href={`/print/picklist?shipment=${s.id}`} target="_blank" rel="noreferrer">
                            Нэгтгэл
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="ghost" title="Excel татах">
                          <a href={`/admin/export?shipment=${s.id}`}>
                            <FileSpreadsheet className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={4}>Нийт</TableCell>
                <TableCell className="text-right tabular-nums">{totals.orders}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.boxes}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.pieces}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMnt(totals.amount)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
