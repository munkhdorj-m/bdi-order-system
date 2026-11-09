/**
 * e-Barimt (PosAPI 3.0) receipts for BDI's sales.
 *
 * The website builds the receipt body from an order when an admin presses
 * "Илгээх" and queues it in ebarimt_receipts (fix 37). The agent on BDI's
 * computer (web/scripts/ebarimt-agent.mjs) adds the merchant fields
 * (merchantTin, posNo, branchNo, districtCode, billIdSuffix), looks up the
 * buyer's ТТД, sends it to the local PosAPI and writes the answer back.
 *
 * Money: shelf prices include VAT, so an item's VAT is total × 10/110 —
 * or × 10/112 with 2% city tax on top for city-tax goods (BDI has none
 * today). VAT-free goods go in their own sub-receipt and need the tax
 * office's product code (products.ebarimt_tax_code).
 *
 * Pure functions — no I/O — so they can be checked without PosAPI.
 */

export const VAT_RATE = 0.1;
export const CITY_TAX_RATE = 0.02;

export type ReceiptType = "B2B_RECEIPT" | "B2C_RECEIPT";
export type TaxType = "VAT_ABLE" | "VAT_FREE";

export type EbarimtStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "return_queued"
  | "returning"
  | "returned";

export const EBARIMT_STATUS_LABELS: Record<EbarimtStatus, string> = {
  queued: "Дараалалд",
  sending: "Илгээж байна",
  sent: "Илгээсэн",
  failed: "Алдаа",
  return_queued: "Буцаах хүсэлт",
  returning: "Буцааж байна",
  returned: "Буцаасан",
};

export const EBARIMT_STATUS_COLOR: Record<EbarimtStatus, string> = {
  queued: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  sending: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  return_queued: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  returning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  returned: "bg-muted text-muted-foreground",
};

/** A receipt still counts for the order (blocks sending another one). */
export const LIVE_STATUSES: EbarimtStatus[] = ["queued", "sending", "sent", "return_queued", "returning"];

/** Orders per queueReceipts call; the e-Barimt page sends more in batches. */
export const EBARIMT_QUEUE_BATCH = 200;

/**
 * The buyer's registry number if it looks real: 7 digits (company),
 * 2 Cyrillic letters + 8 digits (citizen), or an 11–12 digit ТТД.
 * Mercury uses "0000…" for "none" — those, and anything odd, mean the
 * sale goes out as a consumer (B2C) receipt.
 */
export function cleanRegistry(raw: string | null | undefined): string | null {
  const s = (raw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!s || /^0+$/.test(s)) return null;
  if (/^\d{7}$/.test(s) || /^\d{11,12}$/.test(s) || /^[А-ЯЁӨҮ]{2}\d{8}$/.test(s)) return s;
  return null;
}

export type ReceiptLine = {
  name: string;
  sku: string | null;
  unit: string | null;
  qty: number;
  unitPrice: number;
  vatPayable: boolean | null;
  cityTax: boolean | null;
  classificationCode: string | null;
  taxProductCode: string | null;
};

export type BuiltReceipt = {
  type: ReceiptType;
  registryNumber: string | null;
  totalAmount: number;
  totalVat: number;
  totalCityTax: number;
  /** PosAPI body without the merchant fields the agent adds. */
  request: Record<string, unknown>;
  /** Blocking problems — don't queue while any are present. */
  problems: string[];
  /** Worth knowing, but PosAPI may still accept it. */
  warnings: string[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function barCodeType(code: string | null): "GS1" | "UNDEFINED" {
  return code && /^(\d{8}|\d{12,14})$/.test(code) ? "GS1" : "UNDEFINED";
}

function taxesOf(total: number, taxType: TaxType, cityTax: boolean) {
  if (taxType === "VAT_FREE") return { vat: 0, city: 0 };
  if (cityTax) {
    const base = 1 + VAT_RATE + CITY_TAX_RATE;
    return { vat: round2((total * VAT_RATE) / base), city: round2((total * CITY_TAX_RATE) / base) };
  }
  return { vat: round2((total * VAT_RATE) / (1 + VAT_RATE)), city: 0 };
}

/**
 * Build the PosAPI receipt for one order.
 *
 * Free bonus lines (price 0) are left out — there is nothing to tax. An
 * order-level discount (cash 2%) is spread over the lines in proportion to
 * their value, so the receipt adds up to what the store actually pays
 * (within a tugrik or two of rounding when a discount applies).
 */
export function buildReceipt(input: {
  lines: ReceiptLine[];
  discountTotal: number;
  registryNumber: string | null | undefined;
}): BuiltReceipt {
  const problems: string[] = [];
  const warnings: string[] = [];
  const registryNumber = cleanRegistry(input.registryNumber);
  const type: ReceiptType = registryNumber ? "B2B_RECEIPT" : "B2C_RECEIPT";

  const paid = input.lines.filter((l) => l.qty > 0 && l.unitPrice > 0);
  const free = input.lines.length - paid.length;
  if (free > 0) warnings.push(`${free} үнэгүй (бэлэг) мөр баримтад орохгүй.`);

  const gross = paid.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  if (gross <= 0) problems.push("Баримтад орох дүнтэй бараа алга.");
  const discount = Math.min(Math.max(0, input.discountTotal || 0), gross);
  const factor = gross > 0 ? 1 - discount / gross : 1;

  const groups = new Map<TaxType, Record<string, unknown>[]>();
  const sums = new Map<TaxType, { amount: number; vat: number; city: number }>();

  for (const l of paid) {
    const taxType: TaxType = l.vatPayable === false ? "VAT_FREE" : "VAT_ABLE";
    // Keep qty × unitPrice = totalAmount exactly on every item.
    const unitPrice = discount > 0 ? round2(l.unitPrice * factor) : round2(l.unitPrice);
    const totalAmount = round2(unitPrice * l.qty);
    const { vat, city } = taxesOf(totalAmount, taxType, l.cityTax === true);

    if (!l.classificationCode) warnings.push(`"${l.name}": е-баримтын ангиллын код алга.`);
    if (taxType === "VAT_FREE" && !l.taxProductCode) {
      problems.push(`"${l.name}": НӨАТ-гүй бараанд татварын бүтээгдэхүүний код хэрэгтэй.`);
    }

    const item: Record<string, unknown> = {
      name: l.name.replace(/^🎁\s*/, "").slice(0, 200),
      measureUnit: (l.unit || "ш").slice(0, 20),
      qty: l.qty,
      unitPrice,
      totalAmount,
      totalVAT: vat,
      totalCityTax: city,
    };
    if (l.sku) {
      item.barCode = l.sku;
      item.barCodeType = barCodeType(l.sku);
    } else {
      item.barCodeType = "UNDEFINED";
    }
    if (l.classificationCode) item.classificationCode = l.classificationCode;
    if (l.taxProductCode) item.taxProductCode = l.taxProductCode;

    groups.set(taxType, [...(groups.get(taxType) ?? []), item]);
    const s = sums.get(taxType) ?? { amount: 0, vat: 0, city: 0 };
    sums.set(taxType, { amount: s.amount + totalAmount, vat: s.vat + vat, city: s.city + city });
  }

  const receipts = [...groups.entries()].map(([taxType, items]) => {
    const s = sums.get(taxType)!;
    return {
      taxType,
      totalAmount: round2(s.amount),
      totalVAT: round2(s.vat),
      totalCityTax: round2(s.city),
      items,
    };
  });

  const totalAmount = round2(receipts.reduce((s, r) => s + r.totalAmount, 0));
  const totalVat = round2(receipts.reduce((s, r) => s + r.totalVAT, 0));
  const totalCityTax = round2(receipts.reduce((s, r) => s + r.totalCityTax, 0));

  const request: Record<string, unknown> = {
    type,
    totalAmount,
    totalVAT: totalVat,
    totalCityTax,
    receipts,
    payments: [{ code: "CASH", status: "PAID", paidAmount: totalAmount }],
  };

  return { type, registryNumber, totalAmount, totalVat, totalCityTax, request, problems, warnings };
}
