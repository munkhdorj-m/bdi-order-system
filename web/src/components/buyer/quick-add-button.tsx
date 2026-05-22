"use client";

import { useState } from "react";
import { Minus, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { addToCart, type CartItem, type CartScope } from "@/lib/cart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  product: Omit<CartItem, "qty">;
  /** Pieces per outer carton. If > 1, opens the unit-picker dialog on tap. */
  boxCount?: number | null;
  scope?: CartScope;
};

type Unit = "piece" | "box";

export function QuickAddButton({ product, boxCount, scope }: Props) {
  const hasBox = (boxCount ?? 0) > 1;
  const piecesPerBox = boxCount ?? 1;
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<Unit>("piece");
  const [qtyInUnit, setQtyInUnit] = useState(1);

  const totalPieces = qtyInUnit * (unit === "box" ? piecesPerBox : 1);

  function handleTrigger(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // No box variant — single-tap-add and we're done.
    if (!hasBox) {
      addToCart(product, 1, scope);
      toast.success("Сагсанд нэмлээ", { description: product.name });
      return;
    }
    setUnit("piece");
    setQtyInUnit(1);
    setOpen(true);
  }

  function handleConfirm() {
    addToCart(product, totalPieces, scope);
    toast.success("Сагсанд нэмлээ", {
      description:
        unit === "box"
          ? `${product.name} · ${qtyInUnit} хайрцаг (${totalPieces} ширхэг)`
          : `${product.name} · ${qtyInUnit} ширхэг`,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={handleTrigger}
          aria-label="Сагсанд нэмэх"
          className="shrink-0 size-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 active:scale-90 transition-all shadow-sm shadow-primary/25"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xs">
        <DialogTitle className="text-base leading-snug">
          {product.name}
        </DialogTitle>
        {product.brand && (
          <DialogDescription className="-mt-1">
            {product.brand}
          </DialogDescription>
        )}

        {/* Unit toggle — pill switcher with an animated active background. */}
        <div className="relative flex bg-muted rounded-full p-1 text-sm font-medium">
          <div
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow-sm transition-transform duration-200 ease-out",
              unit === "box" ? "translate-x-full" : "translate-x-0",
            )}
          />
          <button
            type="button"
            onClick={() => {
              setUnit("piece");
              setQtyInUnit(1);
            }}
            aria-pressed={unit === "piece"}
            className={cn(
              "relative z-10 flex-1 py-2 rounded-full text-xs font-semibold transition-colors",
              unit === "piece" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Ширхэг
          </button>
          <button
            type="button"
            onClick={() => {
              setUnit("box");
              setQtyInUnit(1);
            }}
            aria-pressed={unit === "box"}
            className={cn(
              "relative z-10 flex-1 py-2 rounded-full text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
              unit === "box" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Package className="h-3.5 w-3.5" /> Хайрцаг
          </button>
        </div>

        {/* Quantity stepper — 44px tap targets. */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setQtyInUnit(Math.max(1, qtyInUnit - 1))}
            disabled={qtyInUnit <= 1}
            aria-label="Хасах"
            className="size-11 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted disabled:opacity-40 active:scale-90 transition-all"
          >
            <Minus className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <span
            key={qtyInUnit}
            className="text-2xl font-bold tabular-nums min-w-12 text-center animate-in fade-in zoom-in-95 duration-150"
          >
            {qtyInUnit}
          </span>
          <button
            type="button"
            onClick={() => setQtyInUnit(qtyInUnit + 1)}
            aria-label="Нэмэх"
            className="size-11 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        {unit === "box" && (
          <p className="text-xs text-muted-foreground text-center -mt-1">
            = {totalPieces} ширхэг
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm shadow-primary/20"
        >
          Сагсанд нэмэх
        </button>
      </DialogContent>
    </Dialog>
  );
}
