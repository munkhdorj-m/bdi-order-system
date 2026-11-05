"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw, Trash2, X } from "lucide-react";
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
  deleteCancelledOrder,
  reopenOrder,
} from "@/app/admin/orders/actions";

type Result = { error?: string };

type Props = {
  orderId: string;
  status: OrderStatus;
};

export function OrderActions({ orderId, status }: Props) {
  const router = useRouter();
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => reopenOrder(orderId))}
        >
          <RotateCcw className="h-4 w-4" />
          Захиалгыг сэргээх
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm("Энэ цуцлагдсан захиалгыг бүр мөсөн устгах уу? Буцаах боломжгүй.")) return;
            startTransition(async () => {
              const result = await deleteCancelledOrder(orderId);
              if (result.error) {
                alert(`Алдаа: ${result.error}`);
                return;
              }
              router.push("/admin/orders");
            });
          }}
        >
          <Trash2 className="h-4 w-4" />
          Устгах
        </Button>
      </div>
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
