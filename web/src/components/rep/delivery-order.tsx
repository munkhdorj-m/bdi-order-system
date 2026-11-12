"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Minus, PackageCheck, Phone, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatMnt } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import type { DeliveryOrder } from "@/lib/delivery-runs";
import { completeDelivery, couldNotDeliver } from "@/app/rep/delivery/actions";

const FAIL_REASONS = ["Дэлгүүр хаалттай", "Хүлээн авах хүн байхгүй", "Авахаас татгалзсан", "Төлбөр бэлэн биш"];

/**
 * The delivery person's view of one order. On a run that has left, the
 * quantities can be set to what was actually handed over (0 = not that
 * product); "Хүргэсэн" saves them and marks the order delivered.
 */
export function DeliveryOrderView({ order }: { order: DeliveryOrder }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const paid = order.lines.filter((l) => l.unit_price > 0);
  const gifts = order.lines.filter((l) => l.unit_price === 0);
  // Only what the delivery person changed; everything else reads the ordered quantity.
  const [qty, setQty] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState("");

  const out = order.shipment.status === "closed";
  const canDeliver = out && order.status === "shipped";
  const done = order.status === "delivered";

  // One row per product, as the server sees the order.
  const rows = [...new Map(paid.map((l) => [l.product_id, l])).values()].map((l) => ({
    ...l,
    ordered: paid.filter((x) => x.product_id === l.product_id).reduce((s, x) => s + x.qty, 0),
  }));
  const changes = rows.filter((r) => (qty[r.product_id] ?? r.ordered) !== r.ordered);
  const newSubtotal = rows.reduce((s, r) => s + (qty[r.product_id] ?? r.ordered) * r.unit_price, 0);
  const nothing = rows.every((r) => (qty[r.product_id] ?? r.ordered) === 0);
  const pieces = rows.reduce((s, r) => s + (qty[r.product_id] ?? r.ordered), 0);
  const due = Math.max(0, order.subtotal - order.discount_total);

  function set(productId: string, n: number) {
    setQty((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(100_000, Math.floor(Number.isFinite(n) ? n : 0))) }));
  }

  function deliver() {
    start(async () => {
      const r = await completeDelivery({
        orderId: order.id,
        changes: changes.map((c) => ({ product_id: c.product_id, qty: qty[c.product_id] ?? c.ordered })),
        expectedUpdatedAt: order.updated_at,
      });
      setConfirming(false);
      if (r.error) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      toast.success(`${order.store.name}: хүргэгдлээ`);
      router.replace("/rep/delivery");
    });
  }

  function fail() {
    const why = reason.trim();
    if (!why) return toast.error("Шалтгаанаа сонгоно уу.");
    start(async () => {
      const r = await couldNotDeliver({ orderId: order.id, reason: why });
      setFailing(false);
      if (r.error) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      toast.success("Оффист мэдэгдлээ");
      router.replace("/rep/delivery");
    });
  }

  const mapHref =
    order.store.lat != null && order.store.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${order.store.lat},${order.store.lng}`
      : null;

  return (
    <main className={cn("mx-auto w-full max-w-2xl px-3 pt-3 sm:px-4", canDeliver ? "pb-40" : "pb-10")}>
      {/* Store: where, and how to reach them */}
      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="text-[13px] leading-snug text-muted-foreground">
          {[order.store.district, order.store.address].filter(Boolean).join(" · ") || "Хаяг бүртгэгдээгүй"}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {order.store.phone && (
            <Button asChild variant="outline" className="h-11 flex-1">
              <a href={`tel:${order.store.phone.replace(/\s/g, "")}`}>
                <Phone className="h-4 w-4" />
                {order.store.phone}
              </a>
            </Button>
          )}
          {mapHref && (
            <Button asChild variant="outline" className="h-11 flex-1">
              <a href={mapHref} target="_blank" rel="noreferrer">
                <MapPin className="h-4 w-4" />
                Газрын зураг
              </a>
            </Button>
          )}
        </div>
      </div>

      {order.notes && (
        <div className="mt-3 rounded-2xl bg-amber-50 p-3.5 text-[13px] leading-relaxed text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60">
          {order.notes}
        </div>
      )}

      {done && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3.5 text-[13.5px] font-semibold text-emerald-800 ring-1 ring-emerald-300/60 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-800/60">
          <PackageCheck className="h-5 w-5" />
          Хүргэгдсэн
        </div>
      )}
      {!out && (
        <div className="mt-3 rounded-2xl bg-sky-50 p-3.5 text-[13px] text-sky-900 ring-1 ring-sky-300/60 dark:bg-sky-950/30 dark:text-sky-100 dark:ring-sky-800/60">
          Оффис ачилтаа хаагаагүй байна. Хаасны дараа хүргэсэн гэж тэмдэглэх боломжтой болно.
        </div>
      )}

      {/* Lines */}
      <div className="mt-3 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-bold">Бараа</h2>
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {rows.length} төрөл · {pieces}ш
          </span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const n = qty[r.product_id] ?? r.ordered;
            const changed = n !== r.ordered;
            return (
              <li key={r.product_id} className={cn("px-4 py-3", changed && "bg-primary/5")}>
                <div className={cn("text-[13.5px] font-semibold leading-snug", n === 0 && "text-muted-foreground line-through")}>
                  {r.name}
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1 text-[12px] text-muted-foreground tabular-nums">
                    {formatMnt(r.unit_price)}
                    {r.box_count && r.box_count > 1 ? ` · хайрцаг ${r.box_count}ш` : ""}
                    {changed && <span className="ml-1 font-semibold text-primary">· захиалсан {r.ordered}</span>}
                  </div>
                  {canDeliver ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11"
                        onClick={() => set(r.product_id, n - 1)}
                        disabled={busy || n <= 0}
                        aria-label={`${r.name} нэгээр хасах`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={n === 0 ? "" : n}
                        placeholder="0"
                        onChange={(e) => set(r.product_id, Number(e.target.value))}
                        disabled={busy}
                        className="h-11 w-16 text-center text-[15px] font-semibold tabular-nums"
                        aria-label={`${r.name} хүргэсэн тоо`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11"
                        onClick={() => set(r.product_id, n + 1)}
                        disabled={busy}
                        aria-label={`${r.name} нэгээр нэмэх`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      {changed && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 text-muted-foreground"
                          onClick={() => set(r.product_id, r.ordered)}
                          disabled={busy}
                          aria-label={`${r.name} захиалсан тоо руу буцаах`}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="shrink-0 text-[15px] font-semibold tabular-nums">{r.ordered}ш</div>
                  )}
                </div>
                <div className="mt-1 text-right text-[12.5px] font-semibold tabular-nums">{formatMnt(n * r.unit_price)}</div>
              </li>
            );
          })}
          {gifts.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3 text-muted-foreground">
              <div className="min-w-0 flex-1 text-[13px] leading-snug">{g.name}</div>
              <div className="shrink-0 text-[14px] font-semibold tabular-nums">{g.qty}ш</div>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-border bg-muted/40 px-4 py-3 text-[13px]">
          {order.discount_total > 0 && changes.length === 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <span>Хямдрал</span>
              <span className="tabular-nums">−{formatMnt(order.discount_total)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">
              {changes.length > 0 ? "Шинэ дүн" : "Авах дүн"}
              {order.payment_method && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground ring-1 ring-border">
                  {PAYMENT_METHOD_LABELS[order.payment_method]}
                </span>
              )}
            </span>
            <span className="text-[17px] font-bold tabular-nums">{formatMnt(changes.length > 0 ? newSubtotal : due)}</span>
          </div>
          {changes.length > 0 && (
            <div className="text-[12px] text-muted-foreground">
              Захиалсан дүн {formatMnt(due)} байсан.
              {order.hasDeals || order.discount_total > 0 ? " Хөнгөлөлтийг хадгалахад дахин бодно." : ""}
            </div>
          )}
        </div>
      </div>

      {canDeliver && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Button type="button" variant="outline" className="h-12 flex-1" disabled={busy} onClick={() => setFailing(true)}>
              Хүргэж чадсангүй
            </Button>
            <Button
              type="button"
              variant="gold"
              className="h-12 flex-[1.4] text-[15px]"
              disabled={busy || nothing}
              onClick={() => setConfirming(true)}
            >
              <PackageCheck className="h-5 w-5" />
              Хүргэсэн
            </Button>
          </div>
          {nothing && (
            <p className="mx-auto mt-1.5 max-w-2xl text-center text-[12px] text-muted-foreground">
              Юу ч хүргээгүй бол «Хүргэж чадсангүй» дарна уу.
            </p>
          )}
        </div>
      )}

      {/* Confirm: delivered */}
      <Dialog open={confirming} onOpenChange={(o) => !busy && setConfirming(o)}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-[16px] leading-snug">«{order.store.name}»-д хүргэсэн үү?</DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed">
              {pieces}ш бараа, {formatMnt(changes.length > 0 ? newSubtotal : due)}
              {changes.length > 0 ? ` (${changes.length} барааны тоо захиалснаас өөр)` : ""}. Дэлгүүрт мэдэгдэл очно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Болих
            </Button>
            <Button type="button" onClick={deliver} disabled={busy} autoFocus>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Тийм, хүргэсэн
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Could not deliver: why */}
      <Dialog open={failing} onOpenChange={(o) => !busy && setFailing(o)}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-[16px] leading-snug">Яагаад хүргэж чадсангүй вэ?</DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed">
              Захиалга оффис руу буцаж, дараагийн ачилтад орно.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {FAIL_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="chip h-10 px-3"
                data-active={reason === r || undefined}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Эсвэл өөрөө бичих"
            maxLength={200}
            className="h-11"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setFailing(false)} disabled={busy}>
              Болих
            </Button>
            <Button type="button" onClick={fail} disabled={busy || !reason.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Оффист буцаах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
