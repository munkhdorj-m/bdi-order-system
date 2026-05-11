"use client";

import { useTransition } from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NEXT_STATUS,
  NEXT_STATUS_LABEL,
  isFinal,
  type OrderStatus,
} from "@/lib/order-status";
import {
  advanceOrderStatus,
  cancelOrder,
  reopenOrder,
} from "@/app/admin/orders/actions";

type Result = { error?: string };

type Props = {
  orderId: string;
  status: OrderStatus;
};

export function OrderActions({ orderId, status }: Props) {
  const [pending, startTransition] = useTransition();
  const next = NEXT_STATUS[status];
  const nextLabel = NEXT_STATUS_LABEL[status];

  function run(promise: () => Promise<Result>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    startTransition(async () => {
      const result = await promise();
      if (result.error) alert(`Алдаа: ${result.error}`);
    });
  }

  if (status === "delivered") {
    return (
      <p className="text-sm text-muted-foreground">
        Энэ захиалга хүргэгдсэн, өөрчлөх боломжгүй.
      </p>
    );
  }

  if (status === "cancelled") {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run(() => reopenOrder(orderId))}
      >
        <RotateCcw className="h-4 w-4" />
        Захиалгыг сэргээх
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next && nextLabel && (
        <Button
          disabled={pending}
          onClick={() => run(() => advanceOrderStatus(orderId, status))}
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
      {!isFinal(status) && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () => cancelOrder(orderId),
              "Энэ захиалгыг цуцлах уу?",
            )
          }
        >
          <X className="h-4 w-4" />
          Цуцлах
        </Button>
      )}
    </div>
  );
}
