/**
 * Payment-method primitives. Kept in its own file because both client
 * and server code reference these — splitting avoids client bundles
 * pulling in the Supabase client through lib/discount.ts.
 */

export type PaymentMethod = "cash" | "credit";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "credit",
  "cash",
] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Бэлэн",
  credit: "Зээл",
};

export const PAYMENT_METHOD_DESCRIPTIONS: Record<PaymentMethod, string> = {
  cash: "Хүргэлтийн үед бэлнээр төлнө · 2% хямдрал",
  credit: "Дараа төлбөртэйгээр (хуваарьт)",
};

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "cash" || v === "credit";
}
