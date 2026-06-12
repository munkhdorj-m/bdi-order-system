"use client";

import { useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NEXT_STATUS, NEXT_STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { advanceOrderStatus } from "@/app/admin/orders/actions";

/**
 * One-tap status advance for order LIST rows (admin orders table +
 * dashboard pending queue). The single most common admin task is
 * walking the day's orders through pending → confirmed → shipped →
 * delivered; without this button every transition costs a round-trip
 * into the detail page and back.
 *
 * Renders nothing for final statuses (delivered/cancelled) — those
 * need the detail page's full controls (reopen) anyway.
 */
export function QuickAdvanceButton({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [pending, startTransition] = useTransition();
  const next = NEXT_STATUS[status];
  const label = NEXT_STATUS_LABEL[status];

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
      toast.success(label!);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={advance}
      className="h-7 px-2.5 text-[12px] font-semibold text-primary border-primary/30 hover:bg-primary/5 hover:text-primary"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <>
          {label}
          <ArrowRight className="h-3.5 w-3.5" />
        </>
      )}
    </Button>
  );
}
