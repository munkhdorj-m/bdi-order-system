import {
  STATUS_COLOR,
  STATUS_ICON,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";

export function OrderStatusPill({
  status,
  size = "sm",
}: {
  status: OrderStatus;
  size?: "sm" | "md";
}) {
  const Icon = STATUS_ICON[status];
  const sizing =
    size === "md"
      ? "text-sm px-2.5 py-1 gap-1.5"
      : "text-xs px-2 py-0.5 gap-1";
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizing} ${STATUS_COLOR[status]}`}
    >
      <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {STATUS_LABELS[status]}
    </span>
  );
}
