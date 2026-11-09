"use client";

import { useOptimistic, useState, useTransition } from "react";
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

type Patch = { id: string; qty: number } | { id: string; remove: true };

/** Apply a quantity change / removal to the visible rows before the server answers. */
function applyPatch(state: OrderItem[], patch: Patch): OrderItem[] {
  if ("remove" in patch) return state.filter((i) => i.id !== patch.id);
  return state.map((i) =>
    i.id === patch.id ? { ...i, qty: patch.qty, line_total: patch.qty * i.unit_price } : i,
  );
}

export function OrderEditControls({ orderId, orderNumber, items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Rows update the moment +/− is tapped; the server's answer (the action
  // revalidates this page) replaces them, and a failure snaps them back.
  const [view, applyOptimistic] = useOptimistic(items, applyPatch);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  // Surfaces server-action errors inline (in addition to toast) so the user
  // sees them anchored to the failing row even if the toast is dismissed.
  const [error, setError] = useState<string | null>(null);

  function withResult<T extends { error?: string }>(
    patch: Patch | null,
    runner: () => Promise<T>,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      if (patch) applyOptimistic(patch);
      const r = await runner();
      if (r.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      onSuccess?.();
    });
  }

  function changeQty(item: OrderItem, delta: number) {
    setQty(item, Math.max(1, item.qty + delta));
  }

  function setQty(item: OrderItem, next: number) {
    if (next === item.qty) return;
    // Absolute quantities, and Next runs a client's actions one at a time,
    // so quick repeated taps settle on the last one.
    withResult({ id: item.id, qty: next }, () => updateOrderItemQty(orderId, item.id, next));
  }

  function confirmRemoveItem(item: OrderItem) {
    // Free gifts don't count: at least one paid line has to stay.
    if (view.filter((i) => i.unit_price > 0).length <= 1) {
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
    withResult(
      { id: item.id, remove: true },
      () => removeOrderItem(orderId, item.id),
      () => toast.success("Бараа хасагдлаа"),
    );
  }

  function handleCancel() {
    setShowCancelConfirm(false);
    setCancelling(true);
    withResult(
      null,
      async () => {
        const r = await cancelOrder(orderId);
        if (r.error) setCancelling(false);
        return r;
      },
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
        {view.map((item) => (
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

            {item.unit_price === 0 ? (
              // Gift from a deal — shown, not editable.
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60">
                🎁 Бэлэг · {item.qty}ш
              </span>
            ) : removingItemId === item.id ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cancelRemoveItem}
                  disabled={cancelling}
                  className="h-10 px-3 text-xs rounded-lg hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={() => executeRemoveItem(item)}
                  disabled={cancelling}
                  className="h-10 px-3 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 transition-colors"
                >
                  Хасах
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-input bg-card">
                  <button
                    type="button"
                    onClick={() => changeQty(item, -1)}
                    disabled={cancelling || item.qty <= 1}
                    aria-label="Хасах"
                    className="size-10 flex items-center justify-center hover:bg-muted rounded-l-xl disabled:opacity-40 active:scale-90 transition-transform"
                  >
                    <Minus className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                  <QtyField value={item.qty} disabled={cancelling} onCommit={(n) => setQty(item, n)} />
                  <button
                    type="button"
                    onClick={() => changeQty(item, +1)}
                    disabled={cancelling}
                    aria-label="Нэмэх"
                    className="size-10 flex items-center justify-center hover:bg-muted rounded-r-xl disabled:opacity-40 active:scale-90 transition-transform"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => confirmRemoveItem(item)}
                  disabled={cancelling}
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
                {cancelling ? "Цуцалж байна..." : "Цуцлах"}
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

/** The quantity, typeable: tap it, type 72, press Enter — one save. */
function QtyField({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }
  function commit() {
    const n = Math.floor(Number(draft));
    if (draft.trim() === "" || !Number.isFinite(n) || n < 1) {
      setDraft(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={5}
      value={draft}
      disabled={disabled}
      aria-label="Тоо ширхэг"
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-10 w-14 bg-transparent text-center text-sm font-semibold tabular-nums outline-none focus:bg-muted/60"
    />
  );
}
