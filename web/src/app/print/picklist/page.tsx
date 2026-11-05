import { createClient } from "@/lib/supabase/server";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { COMPANY } from "@/lib/company";
import { formatAmount, shipmentTitle } from "@/lib/dispatch";
import { amountDue, loadDocOrders } from "@/lib/order-docs";

type SearchParams = Promise<{ shipment?: string }>;

/**
 * Нэгтгэл жагсаалт — the loading list for a shipment, as Mercury prints it:
 * one row per product, one column per store, then cartons (Хрц, rounded up:
 * an opened carton still goes on the truck) and pieces (Шир).
 */
export default async function PrintPicklistPage({ searchParams }: { searchParams: SearchParams }) {
  const { shipment: shipmentId } = await searchParams;
  const supabase = await createClient();
  const orders = shipmentId ? await loadDocOrders(supabase, { shipmentId }) : [];
  const shipment = orders[0]?.shipment ?? null;

  type Row = {
    key: string;
    name: string;
    code: string | null;
    sku: string | null;
    perBox: number | null;
    byOrder: Map<string, number>;
    total: number;
  };
  const rows = new Map<string, Row>();
  for (const o of orders) {
    for (const i of o.items) {
      const key = `${i.product_id}${i.unit_price === 0 ? ":gift" : ""}`;
      const row = rows.get(key) ?? {
        key,
        name: i.name,
        code: i.product?.internal_code ?? null,
        sku: i.product?.sku ?? null,
        perBox: i.product?.box_count ?? null,
        byOrder: new Map<string, number>(),
        total: 0,
      };
      row.byOrder.set(o.id, (row.byOrder.get(o.id) ?? 0) + i.qty);
      row.total += i.qty;
      rows.set(key, row);
    }
  }
  const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "mn"));
  const cartons = (r: Row) => (r.perBox && r.perBox > 1 ? Math.ceil(r.total / r.perBox) : r.total);
  const piecesFor = (orderId: string) => list.reduce((s, r) => s + (r.byOrder.get(orderId) ?? 0), 0);
  const totalCartons = list.reduce((s, r) => s + cartons(r), 0);
  const totalPieces = list.reduce((s, r) => s + r.total, 0);
  const totalAmount = orders.reduce((s, o) => s + amountDue(o), 0);
  const wide = orders.length > 6;

  return (
    <>
      <style>{`
        @page { size: A4 ${wide ? "landscape" : "portrait"}; margin: 8mm; }
        @media print { .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; } }
      `}</style>
      <PrintToolbar
        title={`Нэгтгэл · ${shipment ? shipmentTitle(shipment.shipment_no) : ""}`}
        subtitle={`${orders.length} захиалга · ${list.length} бараа`}
      />
      <main className="py-6 print:py-0">
        <section
          className={`sheet mx-auto bg-white p-[8mm] text-[10px] shadow-md ${wide ? "w-[297mm]" : "w-[210mm]"} max-w-full`}
        >
          <div className="mb-1 text-[13px] font-bold">Нэгтгэл жагсаалт</div>
          <div className="mb-2 flex flex-wrap gap-x-6">
            <span>
              Байгууллагын нэр : <b>{COMPANY.name}</b>
            </span>
            {shipment && (
              <>
                <span>{shipmentTitle(shipment.shipment_no)}</span>
                <span>Огноо : {shipment.delivery_date}</span>
                <span>
                  Түгээгч : {shipment.distributor ? `${shipment.distributor.name} ${shipment.distributor.phone ?? ""}` : "—"}
                </span>
              </>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="p-6 text-center text-neutral-500">Ачилтад захиалга алга.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-800 text-white">
                  <th className="border border-neutral-600 px-1 py-0.5" rowSpan={2}>
                    No
                  </th>
                  <th className="border border-neutral-600 px-1 py-0.5 text-left" rowSpan={2}>
                    Барааны нэр
                  </th>
                  <th className="border border-neutral-600 px-1 py-0.5" rowSpan={2}>
                    Код
                  </th>
                  <th className="border border-neutral-600 px-1 py-0.5" colSpan={orders.length}>
                    Харилцагчид
                  </th>
                  <th className="border border-neutral-600 px-1 py-0.5" colSpan={2}>
                    Хэмжээ
                  </th>
                </tr>
                <tr className="bg-neutral-800 text-white">
                  {orders.map((o) => (
                    <th key={o.id} className="max-w-[22mm] border border-neutral-600 px-0.5 py-0.5 align-bottom font-semibold leading-tight">
                      {o.store?.name ?? "—"}
                      <div className="font-normal opacity-80">{o.store?.registry_number ?? o.store?.external_id ?? ""}</div>
                    </th>
                  ))}
                  <th className="border border-neutral-600 px-1 py-0.5">Хрц</th>
                  <th className="border border-neutral-600 px-1 py-0.5">Шир</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, n) => (
                  <tr key={r.key}>
                    <td className="border border-neutral-400 px-1 text-center">{n + 1}</td>
                    <td className="border border-neutral-400 px-1">{r.name}</td>
                    <td className="border border-neutral-400 px-1 tabular-nums">{r.code ?? r.sku ?? ""}</td>
                    {orders.map((o) => (
                      <td key={o.id} className="border border-neutral-400 px-1 text-center tabular-nums">
                        {r.byOrder.get(o.id) ?? ""}
                      </td>
                    ))}
                    <td className="border border-neutral-400 px-1 text-center font-bold tabular-nums">{cartons(r)}</td>
                    <td className="border border-neutral-400 px-1 text-center font-bold tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr>
                  <td className="border border-neutral-400 px-1 text-center" colSpan={3} rowSpan={2}>
                    Нийт
                  </td>
                  {orders.map((o) => (
                    <td key={o.id} className="border border-neutral-400 px-1 text-center tabular-nums">
                      {piecesFor(o.id)}
                    </td>
                  ))}
                  <td className="border border-neutral-400 px-1 text-center tabular-nums">{totalCartons}</td>
                  <td className="border border-neutral-400 px-1 text-center tabular-nums">{totalPieces}</td>
                </tr>
                <tr>
                  {orders.map((o) => (
                    <td key={o.id} className="border border-neutral-400 px-1 text-center tabular-nums">
                      {formatAmount(amountDue(o))}
                    </td>
                  ))}
                  <td className="border border-neutral-400 px-1 text-center tabular-nums" colSpan={2}>
                    {formatAmount(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
