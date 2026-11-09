"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { NEXT_STATUS, NEXT_STATUS_LABEL, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { advanceOrderStatus } from "@/app/admin/orders/actions";

/**
 * One-tap next step for order LIST rows (orders table, dashboard queue):
 *   pending   → confirm here
 *   confirmed → "Ачилтад оноох": opens the dispatch board for its delivery
 *               day (orders ship by going on a run, so they're printed)
 *   shipped   → mark delivered here, after a confirmation (it's final)
 * Renders nothing for delivered/cancelled.
 */
export function QuickAdvanceButton({
  orderId,
  orderNumber,
  status,
  deliveryDate,
}: {
  orderId: string;
  /** Shown in the "delivered?" confirmation. */
  orderNumber?: string;
  status: OrderStatus;
  deliveryDate?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const next = NEXT_STATUS[status];
  const label = NEXT_STATUS_LABEL[status];

  if (status === "confirmed") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-primary border-primary/30"
        onClick={() => router.push(deliveryDate ? `/admin/dispatch?date=${deliveryDate}` : "/admin/dispatch")}
      >
        <Truck className="size-4" />
        Ачилтад оноох
      </Button>
    );
  }

  if (!next || !label) return null;

  function advance() {
    startTransition(async () => {
      const result = await advanceOrderStatus(orderId, status);
      setConfirming(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${STATUS_LABELS[next!]} боллоо`);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => (next === "delivered" ? setConfirming(true) : advance())}
        className="text-primary border-primary/30"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            {next === "delivered" ? "Хүргэгдсэн" : label}
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      {next === "delivered" && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={`${orderNumber ?? "Захиалгыг"} хүргэгдсэн гэж тэмдэглэх үү?`}
          description="Дэлгүүрт мэдэгдэл очно. Хүргэгдсэн захиалгыг дараа нь өөрчлөх боломжгүй."
          confirmLabel="Хүргэгдсэн"
          pending={pending}
          onConfirm={advance}
        />
      )}
    </>
  );
}
