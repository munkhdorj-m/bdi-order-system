/**
 * Mercury mirror — labels and helpers for the admin pages that browse
 * public.mercury_records (filled by scripts/mercury-sync.mjs, schema in
 * docs/fixes/35-mercury-mirror.sql).
 *
 * The mirror stores each Mercury row verbatim as JSON (column label → text),
 * so these pages render whatever columns Mercury had rather than a fixed
 * schema. Read-only by design: nothing here writes back to Mercury or into
 * the live catalog.
 */

export type MercuryGroup = "catalog" | "customers" | "history" | "staff" | "gps";

export type MercuryEntityInfo = {
  label: string;
  group: MercuryGroup;
  /** Transactional records carry a business date and are browsed month by month. */
  dated: boolean;
};

export const MERCURY_GROUPS: Record<MercuryGroup, string> = {
  catalog: "Каталог",
  customers: "Харилцагч",
  history: "Гүйлгээний түүх",
  staff: "Ажилтан",
  gps: "GPS",
};

/** Every record type the sync script pulls (keep in step with MASTER / BY_DATE there). */
export const MERCURY_ENTITIES: Record<string, MercuryEntityInfo> = {
  product: { label: "Бараа", group: "catalog", dated: false },
  product_detail: { label: "Барааны дэлгэрэнгүй (НӨАТ, Е-баримт код)", group: "catalog", dated: false },
  stock_balance: { label: "Барааны үлдэгдэл", group: "catalog", dated: false },
  price_type: { label: "Үнийн ангилал", group: "catalog", dated: false },
  product_category: { label: "Барааны ангилал", group: "catalog", dated: false },
  manufacturer: { label: "Үйлдвэр / бүлэг", group: "catalog", dated: false },
  warehouse: { label: "Агуулах", group: "catalog", dated: false },
  promotion: { label: "Урамшуулал", group: "catalog", dated: false },
  product_set: { label: "Худалдааны багц", group: "catalog", dated: false },
  keyword: { label: "Түлхүүр үг", group: "catalog", dated: false },
  sales_plan: { label: "Борлуулалтын төлөвлөгөө", group: "catalog", dated: false },
  customer: { label: "Харилцагч", group: "customers", dated: false },
  customer_detail: { label: "Харилцагчийн дэлгэрэнгүй (гэрээний үнэ)", group: "customers", dated: false },
  customer_ledger: { label: "Авлагын тооцоо", group: "customers", dated: false },
  customer_type: { label: "Харилцагчийн төрөл", group: "customers", dated: false },
  customer_loan: { label: "Зээл", group: "customers", dated: false },
  visit_plan: { label: "Айлчлалын төлөвлөгөө", group: "customers", dated: false },
  order: { label: "Захиалга", group: "history", dated: true },
  order_line: { label: "Захиалгын мөр (хүргэгдээгүй)", group: "history", dated: true },
  document: { label: "Баримт", group: "history", dated: true },
  bigdata_line: { label: "Гүйлгээний мөр (BigData)", group: "history", dated: true },
  payment_summary: { label: "Төлбөрийн нэгтгэл", group: "history", dated: true },
  bank_statement: { label: "Дансны хуулга", group: "history", dated: true },
  ebarimt: { label: "Е-баримт", group: "history", dated: true },
  customer_comment: { label: "Санал хүсэлт", group: "history", dated: true },
  deleted_order: { label: "Устгасан захиалга", group: "history", dated: true },
  card_read: { label: "Карт уншилт", group: "history", dated: true },
  user: { label: "Хэрэглэгч", group: "staff", dated: false },
  device: { label: "Утас / төхөөрөмж", group: "staff", dated: false },
  gps_point: { label: "Цэг", group: "gps", dated: false },
  gps_path: { label: "Зам", group: "gps", dated: false },
  gps_area: { label: "Талбай", group: "gps", dated: false },
};

export function entityLabel(entity: string): string {
  return MERCURY_ENTITIES[entity]?.label ?? entity;
}

/** Mercury's own row-number / action columns ("#", "Устгах", "col_7") carry no data. */
const NOISE_COLUMN = /^(#( \(\d+\))?|col_\d+|Устгах)$/;

/**
 * Columns worth showing for a set of records: plain-text keys in first-seen
 * order. Our own `_ids` / `_row` and nested objects (a product's 33 prices)
 * stay in the per-row JSON view instead of exploding the table's width.
 */
export function scalarColumns(rows: Record<string, unknown>[], max = 30): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (seen.has(k)) continue;
      seen.add(k);
      if (k.startsWith("_") || NOISE_COLUMN.test(k) || (v !== null && typeof v === "object")) continue;
      cols.push(k);
      if (cols.length >= max) return cols;
    }
  }
  return cols;
}

/** "2026-11" → ["2026-11-01", "2026-11-30"]. */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

/** Months from the first to the last date, newest first: ["2026-11", "2026-10", …]. */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let y = Number(last.slice(0, 4));
  let m = Number(last.slice(5, 7));
  const stop = first.slice(0, 7);
  for (let guard = 0; guard < 600; guard++) {
    const label = `${y}-${String(m).padStart(2, "0")}`;
    out.push(label);
    if (label <= stop) break;
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function formatCount(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US");
}

export function formatSyncTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
