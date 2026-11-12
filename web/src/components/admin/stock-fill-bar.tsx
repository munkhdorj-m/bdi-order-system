"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { setStockForProducts } from "@/app/admin/products/stock-actions";

/**
 * Shown with the "Үлдэгдэлгүй" filter: one figure for every product in
 * view, so a batch of products that arrived with stock 0 (and so can't be
 * ordered) is fixed in one go instead of card by card.
 */
export function StockFillBar({ productIds, visibleToStores }: { productIds: string[]; visibleToStores: number }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const n = Math.floor(Number(value));
  const valid = value.trim() !== "" && Number.isFinite(n) && n > 0;

  function save() {
    start(async () => {
      const r = await setStockForProducts(productIds, n);
      setConfirming(false);
      if (r.error) toast.error(r.error);
      if (r.count) toast.success(`${r.count} барааны үлдэгдэл ${n.toLocaleString("en-US")} боллоо`);
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-300/70 dark:bg-amber-950/30 dark:ring-amber-800/60">
      <div className="text-[13px] leading-relaxed text-amber-950 dark:text-amber-100">
        <b>{productIds.length} бараа үлдэгдэлгүй</b>
        {visibleToStores > 0 ? ` — үүнээс ${visibleToStores} нь дэлгүүрт «Дууссан» гэж харагдаж, захиалах боломжгүй байна.` : "."}{" "}
        Агуулахад байгаа бол үлдэгдлийг нь оруулна уу.
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Жишээ: 1000"
          className="h-10 w-36 bg-card"
          aria-label="Үлдэгдлийн тоо"
        />
        <Button type="button" disabled={busy || !valid || productIds.length === 0} onClick={() => setConfirming(true)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
          Харагдаж буй {productIds.length} бараанд тавих
        </Button>
        <span className="text-[12px] text-amber-900/80 dark:text-amber-200/80">
          Зарим нь л байгаа бол эхлээд хайлт, ангиллаар шүүгээд дараа нь тавина.
        </span>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${productIds.length} барааны үлдэгдлийг ${valid ? n.toLocaleString("en-US") : ""} болгох уу?`}
        description="Дэлгүүрүүд эдгээр барааг шууд захиалах боломжтой болно. Барааны хуудаснаас нэг бүрчлэн засаж болно."
        confirmLabel="Тийм, тавих"
        pending={busy}
        onConfirm={save}
      />
    </div>
  );
}
