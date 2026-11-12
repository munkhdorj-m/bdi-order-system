/**
 * Sales for the accounting system — Dayansoft ERP's own batch-import
 * layout (Templates/Dayansoft.Template.SalesBatch.xlsx: one sheet named
 * "Sheet", these 24 columns, one row per document line).
 *
 * Today Dayansoft pulls BDI's sales from Mercury by itself. Once Mercury
 * is off, the accountant imports this file instead. Pure — no I/O.
 *
 * Not yet confirmed against a real import (it needs the accountant):
 *   - "Харилцагч код" / "Бараа код" must be the codes Dayansoft knows the
 *     customer and the item by. The file can carry the registry number or
 *     Mercury's customer number, and the internal code or the barcode —
 *     whichever matches (options below).
 *   - "Бараа данс" is the item's account in BDI's chart of accounts; the
 *     accountant supplies it.
 *   - Amounts include VAT (shelf prices do); "НӨАТ" is the VAT inside the
 *     line's net amount.
 */

import type { DocOrder } from "@/lib/order-docs";
import type { XlsxCell, XlsxSheet } from "@/lib/xlsx";

/** Exactly the template's headers — note "Cериал" starts with a Latin C there. */
export const DAYANSOFT_HEADERS = [
  "Дугаар",
  "Огноо",
  "Харилцагч код",
  "Харилцагч нэр",
  "Утга",
  "Борлуулагч",
  "Пос код",
  "Багц №",
  "Бараа данс",
  "Данс нэр",
  "Бараа код",
  "Бараа нэр",
  "Бараа тайлбар",
  "Comment",
  "Тоо хэмжээ",
  "Нэгж үнэ",
  "Нийт үнэ",
  "Хөнгөлөлт",
  "Нэгж дүн",
  "Нийт дүн",
  "НӨАТ",
  "НХАТ",
  "Cериал дугаар",
  "Дуусах огноо",
] as const;

export type DayansoftOptions = {
  /** "Бараа данс" for every line; blank leaves the column empty. */
  account: string;
  /** Which of the store's numbers is its code in Dayansoft. */
  partnerCode: "registry" | "mercury";
  /** Which of the product's codes is its code in Dayansoft. */
  itemCode: "internal" | "barcode";
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The day the goods went out: the run's day, else the planned day, else the order's own (UB). */
function documentDay(o: DocOrder): string {
  if (o.shipment?.delivery_date) return o.shipment.delivery_date;
  if (o.delivery_date) return o.delivery_date;
  const at = Date.parse(o.shipped_at ?? o.created_at);
  return new Date(at + 8 * 3600_000).toISOString().slice(0, 10);
}

export type DayansoftBatch = {
  sheet: XlsxSheet;
  /** Things the accountant should know before importing. */
  warnings: string[];
  documents: number;
  lines: number;
  total: number;
};

export function buildDayansoftBatch(orders: DocOrder[], options: DayansoftOptions): DayansoftBatch {
  const rows: XlsxCell[][] = [];
  const noPartner = new Set<string>();
  const noItem = new Set<string>();
  let total = 0;

  for (const o of orders) {
    const partner =
      (options.partnerCode === "mercury" ? o.store?.external_id : o.store?.registry_number)?.trim() ||
      // Fall back to the other number rather than an empty required cell.
      (options.partnerCode === "mercury" ? o.store?.registry_number : o.store?.external_id)?.trim() ||
      "";
    if (!partner) noPartner.add(o.store?.name ?? o.order_number);

    const paidGross = o.items.reduce((s, i) => s + (i.unit_price > 0 ? i.qty * i.unit_price : 0), 0);
    const discount = Math.min(Math.max(0, o.discount_total || 0), paidGross);
    const factor = paidGross > 0 ? discount / paidGross : 0;
    const seller = o.shipment?.distributor?.name ?? o.placedBy?.full_name ?? "";
    const day = documentDay(o);

    for (const i of o.items) {
      const code =
        (options.itemCode === "barcode" ? i.product?.sku : i.product?.internal_code)?.trim() ||
        (options.itemCode === "barcode" ? i.product?.internal_code : i.product?.sku)?.trim() ||
        "";
      if (!code) noItem.add(i.name);

      const gross = round2(i.qty * i.unit_price);
      const lineDiscount = i.unit_price > 0 ? round2(gross * factor) : 0;
      const net = round2(gross - lineDiscount);
      const vatable = i.product?.vat_payable !== false;
      const cityTax = i.product?.city_tax === true;
      // Prices include the taxes: take them out of the net amount.
      const base = 1 + (vatable ? 0.1 : 0) + (cityTax ? 0.02 : 0);
      const vat = vatable ? round2((net * 0.1) / base) : 0;
      const city = cityTax ? round2((net * 0.02) / base) : 0;
      total += net;

      rows.push([
        o.order_number,
        day,
        partner,
        o.store?.name ?? "",
        `Борлуулалт ${o.order_number}`,
        seller,
        "",
        o.shipment?.shipment_no != null ? String(o.shipment.shipment_no) : "",
        options.account.trim(),
        "",
        code,
        i.name.replace(/^🎁\s*/, ""),
        i.unit_price === 0 ? "Бэлэг" : "",
        o.notes ?? "",
        i.qty,
        i.unit_price,
        gross,
        lineDiscount,
        i.qty > 0 ? round2(net / i.qty) : 0,
        net,
        vat,
        city,
        "",
        "",
      ]);
    }
  }

  const warnings: string[] = [];
  if (!options.account.trim()) warnings.push("«Бараа данс» хоосон — нягтлан дансны кодоо өгөх хэрэгтэй.");
  if (noPartner.size > 0) {
    warnings.push(`${noPartner.size} харилцагчид код алга: ${[...noPartner].slice(0, 5).join(", ")}${noPartner.size > 5 ? "…" : ""}`);
  }
  if (noItem.size > 0) {
    warnings.push(`${noItem.size} бараанд код алга: ${[...noItem].slice(0, 5).join(", ")}${noItem.size > 5 ? "…" : ""}`);
  }

  const text = "text" as const;
  const money = "money" as const;
  const formats: (typeof text | typeof money | "date" | "int" | undefined)[] = [
    text, "date", text, undefined, undefined, undefined, text, text, text, undefined, text, undefined,
    undefined, undefined, "int", money, money, money, money, money, money, money, text, text,
  ];
  const widths = [17, 11, 14, 34, 26, 16, 9, 9, 12, 14, 14, 40, 14, 24, 10, 11, 13, 11, 11, 13, 11, 9, 13, 13];

  return {
    sheet: {
      name: "Sheet",
      plainHeader: true,
      columns: DAYANSOFT_HEADERS.map((header, i) => ({ header, width: widths[i], format: formats[i] })),
      rows,
    },
    warnings,
    documents: orders.length,
    lines: rows.length,
    total: round2(total),
  };
}
