/**
 * Delivery-day resolution.
 *
 * BDI delivers on a weekly schedule keyed by Ulaanbaatar district. The
 * defaults here mirror the dispatch plan the user shared:
 *   - Сонгино Хайрхан, Баянгол       → Thursday
 *   - Баянзүрх                        → Wednesday
 *   - Чингэлтэй, Сүхбаатар            → Tuesday
 *   - Хан-Уул                         → Friday (sometimes Monday)
 *   - Налайх, Багануур, Багахангай   → on-demand / variable
 *
 * Individual stores can override the district default by setting
 * `supermarkets.delivery_day` (added in fix 19). The resolver below
 * returns the override when present, otherwise the district default,
 * otherwise null for "scheduled on demand".
 */

import { isoWeekday, nextDateForWeekday, todayUb } from "@/lib/dispatch";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_LABELS_MN: Record<Weekday, string> = {
  1: "Даваа",
  2: "Мягмар",
  3: "Лхагва",
  4: "Пүрэв",
  5: "Баасан",
  6: "Бямба",
  7: "Ням",
};

/** Normalize a district string before matching — collapse internal whitespace
 *  and trim, so "Баянгол  Дүүрэг" and "Баянгол Дүүрэг" both hit the map. */
function normalizeDistrict(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * District → default delivery weekday. Districts marked `null` deliver
 * on-demand (variable), per the user's note "Налайх, Багануур, Багахангай
 * are randomly".
 */
export const DISTRICT_DELIVERY_DAY: Record<string, Weekday | null> = {
  "Сонгино Хайрхан Дүүрэг": 4, // Пүрэв
  "Баянгол Дүүрэг": 4, // Пүрэв
  "Баянзүрх Дүүрэг": 3, // Лхагва
  "Чингэлтэй Дүүрэг": 2, // Мягмар
  "Сүхбаатар Дүүрэг": 2, // Мягмар
  "Хан-Уул Дүүрэг": 5, // Баасан (or 1=Даваа per user note)
  "Налайх Дүүрэг": null, // on-demand
  "Багануур Дүүрэг": null, // on-demand
  "Багахангай Дүүрэг": null, // on-demand
};

/**
 * Resolve the delivery weekday for a store. Returns the per-store override
 * first, then the district default, otherwise null.
 */
export function resolveDeliveryDay(args: {
  storeDeliveryDay: number | null | undefined;
  district: string | null | undefined;
}): Weekday | null {
  if (
    args.storeDeliveryDay !== null &&
    args.storeDeliveryDay !== undefined &&
    args.storeDeliveryDay >= 1 &&
    args.storeDeliveryDay <= 7
  ) {
    return args.storeDeliveryDay as Weekday;
  }
  if (args.district) {
    const key = normalizeDistrict(args.district);
    const mapped = DISTRICT_DELIVERY_DAY[key];
    if (mapped !== undefined) return mapped;
  }
  return null;
}

/**
 * "Пүрэв (11/13)" — a business day ("YYYY-MM-DD", Ulaanbaatar) as its
 * weekday and month/day.
 */
export function formatDeliveryDay(day: string): string {
  const weekday = isoWeekday(day) as Weekday;
  const [, m, d] = day.split("-");
  return `${WEEKDAY_LABELS_MN[weekday]} (${m}/${d})`;
}

/**
 * "Пүрэв (11/13)" — the next delivery for a store's weekday, counted in
 * Ulaanbaatar days (the server clock is UTC, so a plain Date would be a
 * day behind before 08:00 UB). Today's weekday means next week's run.
 */
export function formatNextDeliveryLabel(
  weekday: Weekday | null,
  today: string = todayUb(),
): string | null {
  if (weekday === null) return null;
  return formatDeliveryDay(nextDateForWeekday(today, weekday));
}
