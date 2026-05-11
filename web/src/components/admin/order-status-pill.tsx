import { STATUS_COLOR, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
