/**
 * Dates and times as Mongolians read them, in Ulaanbaatar time (UTC+8 all
 * year; the server itself runs in UTC).
 *
 * Built by hand on purpose: `toLocaleString("mn-MN")` prints a month
 * without a year in Roman numerals ("XI/08 13:05"). These give
 * "2026.11.08", "11.08" and "11.08 13:05".
 */

const UB_OFFSET_MS = 8 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

function ub(value: string | Date): Date | null {
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isFinite(t) ? new Date(t + UB_OFFSET_MS) : null;
}

/** "2026.11.08" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = value ? ub(value) : null;
  if (!d) return "—";
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

/** "2026.11.08 13:05" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = value ? ub(value) : null;
  if (!d) return "—";
  return `${formatDate(value!)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "11.08" — this year's dates in tight spots. */
export function formatDayMonth(value: string | Date | null | undefined): string {
  const d = value ? ub(value) : null;
  if (!d) return "—";
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

/** "11.08 13:05" */
export function formatDayMonthTime(value: string | Date | null | undefined): string {
  const d = value ? ub(value) : null;
  if (!d) return "—";
  return `${formatDayMonth(value!)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "13:05" */
export function formatTime(value: string | Date | null | undefined): string {
  const d = value ? ub(value) : null;
  if (!d) return "—";
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
