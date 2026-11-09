import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, hasActiveRole } from "@/lib/auth";
import { buildXlsx, xlsxHeaders, type XlsxSheet } from "@/lib/xlsx";
import { amountDue, loadDocOrders, type DocFilter, type DocOrder } from "@/lib/order-docs";
import { formatDateTimeUb, isIsoDay, splitBoxes, todayUb, ubDayOf } from "@/lib/dispatch";
import { PAYMENT_METHOD_PRINT } from "@/lib/payment-method";
import { ACTIVE_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

/**
 * Excel export of orders — Mercury's "MS-Excel рүү хөрвүүлэх".
 *
 *   ?orders=<id>,<id>,…            chosen orders (up to 300)
 *   ?shipment=<id>                 one delivery run
 *   ?date=YYYY-MM-DD               everything to deliver that day
 *   ?from=…&to=…[&status=…][&store=<id>]
 *                                  orders placed in a date range (UB days);
 *                                  status may be "active"
 *
 * Three tabs: orders, every order line (what the ERP / accountant needs),
 * and product totals.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasActiveRole(session.profile, "admin")) {
    return new NextResponse("Зөвхөн админ татах боломжтой.", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const orderIds = (sp.get("orders") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
  const shipment = sp.get("shipment");
  const date = sp.get("date");
  const from = sp.get("from");
  const to = sp.get("to");
  const status = sp.get("status");
  const store = sp.get("store");

  let filter: DocFilter;
  let label: string;
  if (orderIds.length > 0) {
    if (orderIds.length > 300) {
      return new NextResponse("Нэг удаад 300 хүртэл захиалга татна.", { status: 400 });
    }
    filter = { orderIds };
    label = `Захиалга-сонгосон-${orderIds.length}`;
  } else if (shipment) {
    filter = { shipmentId: shipment };
    label = "Ачилт";
  } else if (isIsoDay(date)) {
    filter = { deliveryDate: date };
    label = `Хүргэлт-${date}`;
  } else if (isIsoDay(from) || isIsoDay(to)) {
    const f = isIsoDay(from) ? from : (to as string);
    const t = isIsoDay(to) ? to : f;
    filter = {
      createdFrom: f <= t ? f : t,
      createdTo: f <= t ? t : f,
      status: status && status in STATUS_LABELS ? (status as OrderStatus) : null,
      statuses: status === "active" ? ACTIVE_STATUSES : null,
      storeId: store && UUID_RE.test(store) ? store : null,
    };
    label = f === t ? `Захиалга-${f}` : `Захиалга-${f}_${t}`;
  } else {
    const today = todayUb();
    filter = { createdFrom: today, createdTo: today };
    label = `Захиалга-${today}`;
  }

  const supabase = await createClient();
  let orders: DocOrder[];
  try {
    orders = await loadDocOrders(supabase, filter);
  } catch (e) {
    return new NextResponse(`Алдаа: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
  }
  if (shipment && orders[0]?.shipment) {
    label = `Ачилт-${orders[0].shipment.shipment_no}-${orders[0].shipment.delivery_date}`;
  }

  // e-Barimt bill numbers for orders that have one (table exists after fix 37),
  // a few requests side by side.
  const billByOrder = new Map<string, string>();
  const chunks: string[][] = [];
  for (let i = 0; i < orders.length; i += 150) chunks.push(orders.slice(i, i + 150).map((o) => o.id));
  const parts = await Promise.all(
    chunks.map((ids) =>
      supabase.from("ebarimt_receipts").select("order_id, bill_id").in("order_id", ids).eq("status", "sent"),
    ),
  );
  for (const { data } of parts) {
    for (const r of data ?? []) if (r.bill_id) billByOrder.set(r.order_id as string, r.bill_id as string);
  }

  const day = (o: DocOrder) => o.shipment?.delivery_date ?? o.delivery_date ?? "";
  const seller = (o: DocOrder) =>
    o.shipment?.distributor ? `${o.shipment.distributor.name} ${o.shipment.distributor.phone ?? ""}`.trim() : "";

  const ordersSheet: XlsxSheet = {
    name: "Захиалга",
    columns: [
      { header: "№", width: 5, format: "int" },
      { header: "Захиалгын дугаар", width: 17 },
      { header: "Захиалсан", width: 17 },
      { header: "Хүргэх өдөр", width: 12 },
      { header: "Ачилт №", width: 9, format: "int" },
      { header: "Түгээгч", width: 18 },
      { header: "Харилцагч", width: 30 },
      { header: "Код", width: 10, format: "text" },
      { header: "РД", width: 12, format: "text" },
      { header: "Хаяг", width: 36 },
      { header: "Утас", width: 14, format: "text" },
      { header: "Төлбөр", width: 10 },
      { header: "Төлөв", width: 16 },
      { header: "Бараа", width: 7, format: "int" },
      { header: "Ширхэг", width: 8, format: "int" },
      { header: "Хайрцаг", width: 8, format: "int" },
      { header: "Дүн", width: 13, format: "money" },
      { header: "Хөнгөлөлт", width: 11, format: "money" },
      { header: "Төлөх дүн", width: 13, format: "money" },
      { header: "Е-баримт ДДТД", width: 36, format: "text" },
      { header: "Захиалга авсан", width: 18 },
      { header: "Тайлбар", width: 30 },
    ],
    rows: orders.map((o, n) => [
      n + 1,
      o.order_number,
      formatDateTimeUb(o.created_at),
      day(o),
      o.shipment?.shipment_no ?? null,
      seller(o),
      o.store?.name ?? "",
      o.store?.external_id ?? "",
      o.store?.registry_number ?? "",
      o.store?.address ?? "",
      o.store?.contact_phone ?? "",
      o.payment_method ? PAYMENT_METHOD_PRINT[o.payment_method] : "",
      STATUS_LABELS[o.status] ?? o.status,
      o.items.length,
      o.items.reduce((s, i) => s + i.qty, 0),
      o.items.reduce((s, i) => s + splitBoxes(i.qty, i.product?.box_count).boxes, 0),
      o.subtotal,
      o.discount_total || 0,
      amountDue(o),
      billByOrder.get(o.id) ?? "",
      o.placedBy?.role === "buyer" ? "Дэлгүүр (апп)" : o.placedBy?.full_name ?? "",
      o.notes ?? "",
    ]),
  };

  const linesSheet: XlsxSheet = {
    name: "Бараа",
    columns: [
      { header: "Огноо", width: 11 },
      { header: "Хүргэх өдөр", width: 12 },
      { header: "Захиалгын дугаар", width: 17 },
      { header: "Харилцагч", width: 30 },
      { header: "Харилцагчийн код", width: 12, format: "text" },
      { header: "РД", width: 12, format: "text" },
      { header: "Барааны код", width: 12, format: "text" },
      { header: "Баркод", width: 15, format: "text" },
      { header: "Барааны нэр", width: 40 },
      { header: "Тоо", width: 8, format: "int" },
      { header: "Үнэ", width: 11, format: "money" },
      { header: "Дүн", width: 13, format: "money" },
      { header: "Төлбөр", width: 10 },
      { header: "Түгээгч", width: 18 },
    ],
    rows: orders.flatMap((o) =>
      o.items.map((i) => [
        ubDayOf(o.created_at),
        day(o),
        o.order_number,
        o.store?.name ?? "",
        o.store?.external_id ?? "",
        o.store?.registry_number ?? "",
        i.product?.internal_code ?? "",
        i.product?.sku ?? "",
        i.name,
        i.qty,
        i.unit_price,
        i.line_total,
        o.payment_method ? PAYMENT_METHOD_PRINT[o.payment_method] : "",
        seller(o),
      ]),
    ),
  };

  const totals = new Map<string, { code: string; sku: string; name: string; qty: number; perBox: number | null; amount: number }>();
  for (const o of orders) {
    for (const i of o.items) {
      const t = totals.get(i.product_id) ?? {
        code: i.product?.internal_code ?? "",
        sku: i.product?.sku ?? "",
        name: i.name.replace(/^🎁\s*/, ""),
        qty: 0,
        perBox: i.product?.box_count ?? null,
        amount: 0,
      };
      t.qty += i.qty;
      t.amount += i.line_total;
      totals.set(i.product_id, t);
    }
  }
  const productSheet: XlsxSheet = {
    name: "Нэгтгэл",
    columns: [
      { header: "Барааны код", width: 12, format: "text" },
      { header: "Баркод", width: 15, format: "text" },
      { header: "Барааны нэр", width: 40 },
      { header: "Нийт тоо", width: 10, format: "int" },
      { header: "Хайрцаг", width: 9, format: "int" },
      { header: "Задгай", width: 8, format: "int" },
      { header: "Дүн", width: 13, format: "money" },
    ],
    rows: [...totals.values()]
      .sort((a, b) => b.qty - a.qty)
      .map((t) => {
        const s = splitBoxes(t.qty, t.perBox);
        return [t.code, t.sku, t.name, t.qty, s.boxes, s.loose, t.amount];
      }),
  };

  const bytes = buildXlsx([ordersSheet, linesSheet, productSheet]);
  return new NextResponse(new Uint8Array(bytes).buffer as ArrayBuffer, {
    headers: xlsxHeaders(`${label}.xlsx`),
  });
}
