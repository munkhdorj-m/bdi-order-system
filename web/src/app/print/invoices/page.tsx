import { createClient } from "@/lib/supabase/server";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { COMPANY, DELIVERY_NOTE_FORM } from "@/lib/company";
import { formatAmount, formatDayMn, shipmentTitle, splitBoxes, ubDayOf } from "@/lib/dispatch";
import { amountDue, loadDocOrders, type DocFilter, type DocOrder } from "@/lib/order-docs";
import { PAYMENT_METHOD_PRINT } from "@/lib/payment-method";

type SearchParams = Promise<{ shipment?: string; orders?: string; layout?: string; copies?: string }>;

type Layout = "a4x2" | "a5";

/** One copy of a delivery note — Mercury's "ЗАРЛАГЫН БАРИМТ". */
function DeliveryNote({ o }: { o: DocOrder }) {
  const day = o.shipment?.delivery_date ?? o.delivery_date ?? ubDayOf(o.created_at);
  const seller = o.shipment?.distributor;
  const lines = o.items.map((i) => ({
    ...i,
    perBox: i.product?.box_count ?? null,
    split: splitBoxes(i.qty, i.product?.box_count),
  }));
  const boxes = lines.reduce((s, l) => s + l.split.boxes, 0);
  const pieces = lines.reduce((s, l) => s + l.qty, 0);
  const discount = o.discount_total || 0;

  return (
    <div className="note text-[10.5px] leading-[1.35]">
      <div className="flex justify-between gap-4 text-[9.5px]">
        <b>{DELIVERY_NOTE_FORM.code}</b>
        <span>{DELIVERY_NOTE_FORM.basis}</span>
      </div>
      <div className="my-1.5 text-center text-[12.5px] font-bold">ЗАРЛАГЫН БАРИМТ № : {o.order_number}</div>
      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <div>Байгууллагын нэр : {COMPANY.name}</div>
          <div>Данс : {COMPANY.bank}</div>
          <div>
            Борлуулагч : {seller ? `${seller.name}${seller.phone ? ` ${seller.phone}` : ""}` : "—"}
            {o.shipment ? ` · ${shipmentTitle(o.shipment.shipment_no)}` : ""}
          </div>
          <div>
            ХТ : {o.placedBy?.role === "buyer" ? "Дэлгүүр өөрөө (апп)" : o.placedBy?.full_name || "—"}
            {o.placedBy?.role !== "buyer" && o.placedBy?.phone ? `, Утас : ${o.placedBy.phone.replace(/^976/, "")}` : ""}
          </div>
          <div>Огноо : {formatDayMn(day)}</div>
        </div>
        <div>
          <div>
            Харилцагч : <b>{o.store?.name ?? "—"}</b>
            {o.store?.registry_number ? ` /РД:${o.store.registry_number}/` : ""}
          </div>
          <div>Бүртгэлийн дугаар : {o.store?.external_id ?? "—"}</div>
          <div>Хаяг : {o.store?.address ?? "—"}</div>
          <div>Утас : {o.store?.contact_phone ?? "—"}</div>
          <div>Төлбөрийн хэлбэр : {o.payment_method ? PAYMENT_METHOD_PRINT[o.payment_method] : "—"}</div>
        </div>
      </div>

      <table className="mt-1.5 w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-neutral-800 text-white">
            <th className="border border-neutral-700 px-1 py-0.5">№</th>
            <th className="border border-neutral-700 px-1 py-0.5">Код</th>
            <th className="border border-neutral-700 px-1 py-0.5 text-left">Бараа.нэр</th>
            <th className="border border-neutral-700 px-1 py-0.5">Нэгж</th>
            <th className="border border-neutral-700 px-1 py-0.5">Вох</th>
            <th className="border border-neutral-700 px-1 py-0.5">Зад</th>
            <th className="border border-neutral-700 px-1 py-0.5">Нийт</th>
            <th className="border border-neutral-700 px-1 py-0.5">Үнэ</th>
            <th className="border border-neutral-700 px-1 py-0.5">Нийт дүн</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((i, n) => (
            <tr key={`${i.product_id}-${n}`}>
              <td className="border border-neutral-400 px-1 text-center">{n + 1}</td>
              <td className="border border-neutral-400 px-1 tabular-nums">{i.product?.sku ?? i.product?.internal_code ?? ""}</td>
              <td className="border border-neutral-400 px-1">{i.name}</td>
              <td className="border border-neutral-400 px-1 text-center">
                {i.perBox ? `${i.perBox}${i.product?.unit ?? "ш"}` : i.product?.unit ?? "ш"}
              </td>
              <td className="border border-neutral-400 px-1 text-center tabular-nums">{i.split.boxes || "-"}</td>
              <td className="border border-neutral-400 px-1 text-center tabular-nums">{i.split.loose || "-"}</td>
              <td className="border border-neutral-400 px-1 text-center tabular-nums">{i.qty}</td>
              <td className="border border-neutral-400 px-1 text-right tabular-nums">{formatAmount(i.unit_price)}</td>
              <td className="border border-neutral-400 px-1 text-right tabular-nums">{formatAmount(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className="border border-neutral-400 px-1" colSpan={4}>
              Нийт :
            </td>
            <td className="border border-neutral-400 px-1 text-center tabular-nums">{boxes || "-"}</td>
            <td className="border border-neutral-400 px-1" />
            <td className="border border-neutral-400 px-1 text-center tabular-nums">{pieces}</td>
            <td className="border border-neutral-400 px-1 text-right">{discount > 0 ? "Дүн" : "Төлөх дүн"}</td>
            <td className="border border-neutral-400 px-1 text-right tabular-nums">{formatAmount(o.subtotal)}</td>
          </tr>
          {discount > 0 && (
            <>
              <tr>
                <td className="border border-neutral-400 px-1 text-right" colSpan={8}>
                  Хөнгөлөлт
                </td>
                <td className="border border-neutral-400 px-1 text-right tabular-nums">−{formatAmount(discount)}</td>
              </tr>
              <tr className="font-bold">
                <td className="border border-neutral-400 px-1 text-right" colSpan={8}>
                  Төлөх дүн
                </td>
                <td className="border border-neutral-400 px-1 text-right tabular-nums">{formatAmount(amountDue(o))}</td>
              </tr>
            </>
          )}
        </tfoot>
      </table>

      {o.notes && <div className="mt-1 text-[10px]">Тайлбар: {o.notes}</div>}

      <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[10px]">
        <span className="row-span-2 self-center">Тэмдэг</span>
        <span>Хүлээн авсан харилцагч : ................................ /........................../</span>
        <span>Хүлээлгэн өгсөн ажилтан : ................................ /........................../</span>
      </div>
    </div>
  );
}

/**
 * Delivery notes for a shipment (?shipment=) or chosen orders (?orders=a,b).
 * Default prints two copies of each note on one A4 sheet (cut line between),
 * as BDI prints from Mercury; A5 prints one note per A5 page.
 */
export default async function PrintInvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const layout: Layout = sp.layout === "a5" ? "a5" : "a4x2";
  const copies = sp.copies === "1" ? 1 : 2;

  const filter: DocFilter | null = sp.shipment
    ? { shipmentId: sp.shipment }
    : sp.orders
      ? { orderIds: sp.orders.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300) } // = the order list's limit
      : null;
  const supabase = await createClient();
  const loaded = filter ? await loadDocOrders(supabase, filter) : [];
  // A cancelled order gets no delivery note (a run's list already skips
  // them; ticked orders from the order list may include some).
  const orders = loaded.filter((o) => o.status !== "cancelled");
  const skippedCancelled = loaded.length - orders.length;

  const base = new URLSearchParams();
  if (sp.shipment) base.set("shipment", sp.shipment);
  if (sp.orders) base.set("orders", sp.orders);
  const link = (l: Layout, c: number) => {
    const q = new URLSearchParams(base);
    q.set("layout", l);
    q.set("copies", String(c));
    return `/print/invoices?${q}`;
  };
  const shipment = orders[0]?.shipment;
  const title = shipment
    ? `Падаан · ${shipmentTitle(shipment.shipment_no)} · ${shipment.delivery_date}`
    : `Падаан · ${orders.length} захиалга`;

  return (
    <>
      <style>{`
        @page { size: ${layout === "a5" ? "A5" : "A4"} portrait; margin: ${layout === "a5" ? "6mm" : "8mm"}; }
        .sheet { background: #fff; }
        @media print {
          .sheet { break-after: page; box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; }
          .sheet:last-child { break-after: auto; }
        }
        .cut { border-top: 1px dashed #888; margin: 7mm 0; }
      `}</style>
      <PrintToolbar
        title={title}
        subtitle={`${orders.length} захиалга · ${layout === "a5" ? `A5, ${copies} хувь` : "A4, 2 хувь нэг хуудсанд"}${
          skippedCancelled > 0 ? ` · цуцлагдсан ${skippedCancelled}-г хассан` : ""
        }`}
        options={[
          { label: "A4 · 2 хувь", href: link("a4x2", 2), active: layout === "a4x2" },
          { label: "A5 · 1 хувь", href: link("a5", 1), active: layout === "a5" && copies === 1 },
          { label: "A5 · 2 хувь", href: link("a5", 2), active: layout === "a5" && copies === 2 },
        ]}
      />
      <main className="mx-auto py-6 print:py-0">
        {orders.length === 0 && (
          <div className="no-print mx-auto max-w-md rounded-lg bg-white p-8 text-center text-sm text-neutral-500">
            Хэвлэх захиалга олдсонгүй.
          </div>
        )}
        {layout === "a4x2"
          ? orders.map((o) => (
              <section
                key={o.id}
                className="sheet mx-auto mb-6 w-[210mm] max-w-full p-[8mm] shadow-md print:shadow-none"
              >
                <DeliveryNote o={o} />
                <div className="cut" />
                <DeliveryNote o={o} />
              </section>
            ))
          : orders.flatMap((o) =>
              Array.from({ length: copies }, (_, c) => (
                <section
                  key={`${o.id}-${c}`}
                  className="sheet mx-auto mb-6 w-[148mm] max-w-full p-[6mm] shadow-md print:shadow-none"
                >
                  <DeliveryNote o={o} />
                </section>
              )),
            )}
      </main>
    </>
  );
}
