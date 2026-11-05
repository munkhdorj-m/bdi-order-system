"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw, Trash2, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import {
  NEXT_STATUS,
  NEXT_STATUS_LABEL,
  STATUS_LABELS,
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
  /** For "Ачилтад оноох": open the dispatch board on this day. */
  deliveryDate?: string | null;
};

type Confirming = "cancel" | "delete" | null;

/**
 * Status controls on the order page. Confirmed orders ship through a
 * delivery run (dispatch), so they get a link there instead of a
 * "shipped" button.
 */
export function OrderActions({ orderId, status, deliveryDate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const next = NEXT_STATUS[status];
  const nextLabel = NEXT_STATUS_LABEL[status];

  function run(task: () => Promise<Result>, ok: string, after?: () => void) {
    startTransition(async () => {
      const result = await task();
      setConfirming(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(ok);
      after?.();
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
          onClick={() => run(() => reopenOrder(orderId), "Захиалга сэргээгдлээ")}
        >
          <RotateCcw className="h-4 w-4" />
          Захиалгыг сэргээх
        </Button>
        <Button variant="destructive" disabled={pending} onClick={() => setConfirming("delete")}>
          <Trash2 className="h-4 w-4" />
          Устгах
        </Button>
        <ConfirmDialog
          open={confirming === "delete"}
          onOpenChange={(o) => setConfirming(o ? "delete" : null)}
          title="Цуцлагдсан захиалгыг бүр мөсөн устгах уу?"
          description="Бараа, мэдэгдлүүд нь хамт устна. Буцаах боломжгүй."
          confirmLabel="Устгах"
          destructive
          pending={pending}
          onConfirm={() =>
            run(() => deleteCancelledOrder(orderId), "Захиалга устгагдлаа", () => router.push("/admin/orders"))
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "confirmed" ? (
        <Button asChild>
          <Link href={deliveryDate ? `/admin/dispatch?date=${deliveryDate}` : "/admin/dispatch"}>
            <Truck className="h-4 w-4" />
            Ачилтад оноох
          </Link>
        </Button>
      ) : (
        next &&
        nextLabel && (
          <Button
            disabled={pending}
            onClick={() =>
              run(() => advanceOrderStatus(orderId, status), `${STATUS_LABELS[next]} боллоо`)
            }
          >
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )
      )}
      {!isFinal(status) && (
        <>
          <Button variant="outline" disabled={pending} onClick={() => setConfirming("cancel")}>
            <X className="h-4 w-4" />
            Цуцлах
          </Button>
          <ConfirmDialog
            open={confirming === "cancel"}
            onOpenChange={(o) => setConfirming(o ? "cancel" : null)}
            title="Энэ захиалгыг цуцлах уу?"
            description="Дэлгүүрт мэдэгдэл очно. Хүргэлтийн ачилтаас мөн хасагдана."
            confirmLabel="Цуцлах"
            destructive
            pending={pending}
            onConfirm={() => run(() => cancelOrder(orderId), "Захиалга цуцлагдлаа")}
          />
        </>
      )}
    </div>
  );
}
