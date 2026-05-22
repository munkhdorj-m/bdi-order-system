import {
  CheckCircle2,
  Clock,
  PackageCheck,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

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

// Distinct color per status so the admin can scan the orders list at a glance.
// Each tone carries an explicit dark-mode pair so pills stay readable when the
// user flips the theme toggle.
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

// Solid color tokens for the progress-stepper circles (when the step is
// the current one). Same hue family as STATUS_COLOR.
export const STATUS_SOLID: Record<OrderStatus, string> = {
  pending: "bg-amber-500 text-white",
  confirmed: "bg-sky-500 text-white",
  shipped: "bg-violet-500 text-white",
  delivered: "bg-emerald-500 text-white",
  cancelled: "bg-rose-500 text-white",
};

export const STATUS_RING: Record<OrderStatus, string> = {
  pending: "ring-amber-200 dark:ring-amber-900",
  confirmed: "ring-sky-200 dark:ring-sky-900",
  shipped: "ring-violet-200 dark:ring-violet-900",
  delivered: "ring-emerald-200 dark:ring-emerald-900",
  cancelled: "ring-rose-200 dark:ring-rose-900",
};

export const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  pending: Clock,
  confirmed: CheckCircle2,
  shipped: Truck,
  delivered: PackageCheck,
  cancelled: XCircle,
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

/** Ordered list of the happy-path stages used by the progress stepper. */
export const STATUS_STEPS: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
];

export function isFinal(s: OrderStatus): boolean {
  return s === "delivered" || s === "cancelled";
}

export function statusStepIndex(s: OrderStatus): number {
  return STATUS_STEPS.indexOf(s);
}
