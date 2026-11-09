import {
  STATUS_COLOR,
  STATUS_DOT,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

/** Order status as a tinted pill with a coloured dot — readable at a glance. */
export function OrderStatusPill({
  status,
  size = "sm",
}: {
  status: OrderStatus;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full font-semibold",
        size === "md" ? "h-7 gap-2 px-3 text-[13px]" : "h-6 gap-1.5 px-2.5 text-[11.5px]",
        STATUS_COLOR[status],
      )}
    >
      <span
        aria-hidden="true"
        className={cn("shrink-0 rounded-full", size === "md" ? "size-2" : "size-1.5", STATUS_DOT[status])}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
