"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { formatMnt } from "@/lib/format";
import {
  updateOrderItemQty,
  removeOrderItem,
  cancelOrder,
} from "@/app/(buyer)/orders/actions";

type OrderItem = {
  id: string;
  product_name_snapshot: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

type Props = {
  orderId: string;
  orderNumber?: string;
  items: OrderItem[];
};

export function OrderEditControls({ orderId, orderNumber, items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  // Surfaces server-action errors inline (in addition to toast) so the user
  // sees them anchored to the failing row even if the toast is dismissed.
  const [error, setError] = useState<string | null>(null);

  function withResult<T extends { error?: string }>(
    runner: () => Promise<T>,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const r = await runner();
      setBusyItemId(null);
      if (r.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      onSuccess?.();
    });
  }

  function changeQty(item: OrderItem, delta: number) {
    const next = Math.max(1, item.qty + delta);
    if (next === item.qty) return;
    setBusyItemId(item.id);
    withResult(() => updateOrderItemQty(orderId, item.id, next));
  }

  function confirmRemoveItem(item: OrderItem) {
    if (items.length <= 1) {
      const msg = "Сүүлчийн барааг хасч болохгүй";
      setError(msg);
      toast.error(msg);
      return;
    }
    setRemovingItemId(item.id);
  }

  function cancelRemoveItem() {
    setRemovingItemId(null);
  }

  function executeRemoveItem(item: OrderItem) {
    setRemovingItemId(null);
    setBusyItemId(item.id);
    withResult(
      () => removeOrderItem(orderId, item.id),
      () => toast.success("Бараа хасагдлаа"),
    );
  }

  function handleCancel() {
    setShowCancelConfirm(false);
    withResult(
      () => cancelOrder(orderId),
      () => {
        toast.success("Захиалга цуцлагдлаа");
        router.refresh();
      },
    );
  }

  const label = orderNumber ?? orderId;

  return (
    <div>
      <div className="divide-y">
        {items.map((item) => (
          <div
            key={item.id}
            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm leading-tight">
                {item.product_name_snapshot}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                {formatMnt(item.unit_price)} × {item.qty} ={" "}
                <span className="font-medium text-foreground">
                  {formatMnt(item.line_total)}
                </span>
              </div>
            </div>

            {removingItemId === item.id ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cancelRemoveItem}
                  disabled={pending}
                  className="h-10 px-3 text-xs rounded-lg hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={() => executeRemoveItem(item)}
                  disabled={pending}
                  className="h-10 px-3 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 transition-colors"
                >
                  Хасах
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-full border border-border bg-muted/30">
                  <button
                    type="button"
                    onClick={() => changeQty(item, -1)}
                    disabled={pending || item.qty <= 1}
                    aria-label="Хасах"
                    className="size-10 flex items-center justify-center hover:bg-muted rounded-l-full disabled:opacity-40 active:scale-90 transition-transform"
                  >
                    <Minus className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                  <span className="px-3 text-sm font-semibold min-w-10 text-center tabular-nums">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeQty(item, +1)}
                    disabled={pending}
                    aria-label="Нэмэх"
                    className="size-10 flex items-center justify-center hover:bg-muted rounded-r-full disabled:opacity-40 active:scale-90 transition-transform"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => confirmRemoveItem(item)}
                  disabled={pending || busyItemId === item.id}
                  aria-label="Барааг хасах"
                  className="size-10 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40 transition-colors"
                  title="Барааг хасах"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 pt-3">
          <Callout tone="error">{error}</Callout>
        </div>
      )}

      <div className="px-4 py-3 border-t">
        {showCancelConfirm ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-3">
            <p className="text-sm text-center">
              «{label}» захиалгыг цуцлах уу?
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setShowCancelConfirm(false)}
                disabled={pending}
                className="flex-1"
              >
                Болих
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="default"
                onClick={handleCancel}
                disabled={pending}
                className="flex-1"
              >
                {pending ? "Цуцалж байна..." : "Цуцлах"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Захиалга хүлээгдэж буй үед өөрчилж болно.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="default"
              onClick={() => setShowCancelConfirm(true)}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" />
              Захиалга цуцлах
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
