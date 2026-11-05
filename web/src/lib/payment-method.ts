/**
 * Payment-method primitives. Kept in its own file because both client
 * and server code reference these — splitting avoids client bundles
 * pulling in the Supabase client through lib/discount.ts.
 */

export type PaymentMethod = "cash" | "credit" | "transfer";

/** What a buyer can pick at checkout in the app. */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "credit",
  "cash",
] as const;

/** Everything staff can record — adds bank transfer ("Дансаар" in Mercury). Needs fix 37. */
export const ALL_PAYMENT_METHODS: readonly PaymentMethod[] = [
  "credit",
  "transfer",
  "cash",
] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Бэлэн",
  credit: "Зээл",
  transfer: "Данс",
};

/** Wording on printed delivery notes, as Mercury prints it ("Төлбөрийн хэлбэр: Зээлээр"). */
export const PAYMENT_METHOD_PRINT: Record<PaymentMethod, string> = {
  cash: "Бэлнээр",
  credit: "Зээлээр",
  transfer: "Дансаар",
};

export const PAYMENT_METHOD_DESCRIPTIONS: Record<PaymentMethod, string> = {
  cash: "Хүргэлтийн үед бэлнээр төлнө · 2% хямдрал",
  credit: "Дараа төлбөртэйгээр (хуваарьт)",
  transfer: "Дансаар шилжүүлнэ",
};

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "cash" || v === "credit" || v === "transfer";
}

/** Checkout only offers cash and credit; anything else from a buyer is refused. */
export function isBuyerPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "cash" || v === "credit";
}
