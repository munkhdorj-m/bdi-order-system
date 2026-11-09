/**
 * Helpers for the daily dispatch screens (Хүргэлт хуваарлах, Ачилт,
 * Падаан, Нэгтгэл). Pure functions — safe in client and server code.
 *
 * Dates: business days are Ulaanbaatar calendar days ("YYYY-MM-DD").
 */

export type ShipmentStatus = "open" | "closed";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  open: "Нээлттэй",
  closed: "Хаасан",
};

const UB = "Asia/Ulaanbaatar";

export function isIsoDay(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Today in Ulaanbaatar, "YYYY-MM-DD". */
export function todayUb(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: UB });
}

/** "2026-11-05" ± n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** First instant of a UB day, for timestamptz filters (UB is UTC+8 all year). */
export function ubDayStart(day: string): string {
  return `${day}T00:00:00+08:00`;
}

/** ISO weekday of a "YYYY-MM-DD" (1 = Monday … 7 = Sunday). */
export function isoWeekday(day: string): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The first day after `today` that falls on ISO `weekday` (1 = Monday). */
export function nextDateForWeekday(today: string, weekday: number): string {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (isoWeekday(d) === weekday) return d;
  }
  return addDays(today, 1);
}

/** "2026 оны 11 сарын 04 өдөр" — how Mercury dates a delivery note. */
export function formatDayMn(day: string): string {
  const [y, m, d] = day.split("-");
  return `${y} оны ${m} сарын ${d} өдөр`;
}

/** "2026-11-04 18:24" in UB time. */
export function formatDateTimeUb(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { timeZone: UB });
  const time = d.toLocaleTimeString("en-GB", { timeZone: UB, hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

/** Minutes since an instant (for "last seen" style freshness checks). */
export function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

/** The UB calendar day an instant falls on. */
export function ubDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: UB });
}

const UB_OFFSET_MS = 8 * 3600_000;

/**
 * An instant as "2026-11-08T13:05" in UB time — the value an
 * <input type="datetime-local"> needs. Same on the server (UTC) and in
 * any browser, so the form never shifts by the viewer's own timezone.
 */
export function ubDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + UB_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * "2026-11-08T13:05" typed as UB time → ISO instant. `undefined` for an
 * empty value, `null` when it isn't a valid date-time.
 */
export function parseUbDateTimeInput(v: string | null | undefined): string | null | undefined {
  const s = (v ?? "").trim();
  if (!s) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}+08:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Pieces → full cartons + loose pieces, as on Mercury's delivery note
 * (Вох / Зад). `perBox` is products.box_count (pieces per carton).
 */
export function splitBoxes(qty: number, perBox: number | null | undefined): { boxes: number; loose: number } {
  if (!perBox || perBox <= 1) return { boxes: perBox === 1 ? qty : 0, loose: perBox === 1 ? 0 : qty };
  return { boxes: Math.floor(qty / perBox), loose: qty % perBox };
}

/** 1234567.5 → "1,234,567.5" (no currency sign — printed documents). */
export function formatAmount(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function shipmentTitle(no: number | null | undefined): string {
  return no ? `Ачилт №${no}` : "Ачилт";
}
