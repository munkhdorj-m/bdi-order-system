export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Хүлээгдэж буй",
  confirmed: "Баталгаажсан",
  shipped: "Хүргэлтэнд гарсан",
  delivered: "Хүргэгдсэн",
  cancelled: "Цуцлагдсан",
};

// Distinct color per status so admins can scan the orders list at a glance.
// Each step "warms up" toward emerald (success), with rose for cancelled.
export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  confirmed:
    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  shipped:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  delivered:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled:
    "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

// Forward workflow for admins
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed",
  confirmed: "shipped",
  shipped: "delivered",
};

export const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Баталгаажуулах",
  confirmed: "Хүргэлтэнд гаргах",
  shipped: "Хүргэгдсэн гэж тэмдэглэх",
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
];

export function isFinal(s: OrderStatus): boolean {
  return s === "delivered" || s === "cancelled";
}
