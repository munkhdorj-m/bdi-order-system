"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NEXT_STATUS, NEXT_STATUS_LABEL, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { advanceOrderStatus } from "@/app/admin/orders/actions";

/**
 * One-tap next step for order LIST rows (orders table, dashboard queue):
 *   pending   → confirm here
 *   confirmed → "Ачилтад оноох": opens the dispatch board for its delivery
 *               day (orders ship by going on a run, so they're printed)
 *   shipped   → mark delivered here
 * Renders nothing for delivered/cancelled.
 */
export function QuickAdvanceButton({
  orderId,
  status,
  deliveryDate,
}: {
  orderId: string;
  status: OrderStatus;
  deliveryDate?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = NEXT_STATUS[status];
  const label = NEXT_STATUS_LABEL[status];

  if (status === "confirmed") {
    // A button (not a Link): mobile rows are already links.
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-primary border-primary/30"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(deliveryDate ? `/admin/dispatch?date=${deliveryDate}` : "/admin/dispatch");
        }}
      >
        <Truck className="size-4" />
        Ачилтад оноох
      </Button>
    );
  }

  if (!next || !label) return null;

  function advance(e: React.MouseEvent) {
    // Rows on the mobile list live inside a <Link> — keep the tap from
    // also navigating to the detail page.
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await advanceOrderStatus(orderId, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${STATUS_LABELS[next!]} боллоо`);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={advance}
      className="text-primary border-primary/30"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          {label}
          <ArrowRight className="size-4" />
        </>
      )}
    </Button>
  );
}
