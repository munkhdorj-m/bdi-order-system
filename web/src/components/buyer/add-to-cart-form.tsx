"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { addToCart, type CartItem, type CartScope } from "@/lib/cart";
import { formatMnt } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  product: Omit<CartItem, "qty">;
  /** Pieces per outer carton. If > 1, enables the "Хайрцаг" unit toggle. */
  boxCount?: number | null;
  /** Display-only override for the CTA total. Used when there's an
   *  active per-product discount: the cart still STORES `unit_price`
   *  (the original) so the engine can itemize the discount in the
   *  cart, but the CTA shows the sale price the buyer will pay. */
  displayPrice?: number;
  scope?: CartScope;
  cartHref?: string;
};

type Unit = "piece" | "box";

/**
 * Hi-Fi "Confident" add-to-cart bar. Designed to sit at the bottom of the
 * product detail page (sticky/affixed). Single primary action: the CTA
 * surfaces the running total so the buyer always knows what they're about
 * to commit to. The optional unit pill (Ширхэг ↔ Хайрцаг) only appears when
 * the product has a box size > 1.
 */
export function AddToCartForm({
  product,
  boxCount,
  displayPrice,
  scope,
  cartHref = "/cart",
}: Props) {
  const hasBox = (boxCount ?? 0) > 1;
  const piecesPerBox = boxCount ?? 1;

  const [unit, setUnit] = useState<Unit>("piece");
  const [qtyInUnit, setQtyInUnit] = useState(1);
  // Local typing draft for the editable count input. Synced down to
  // qtyInUnit on blur/Enter; synced up from qtyInUnit when the +/-
  // buttons or unit switch change the canonical value.
  const [qtyDraft, setQtyDraft] = useState<string>("1");
  useEffect(() => {
    setQtyDraft(String(qtyInUnit));
  }, [qtyInUnit]);
  const router = useRouter();

  const piecesPerUnit = unit === "box" ? piecesPerBox : 1;
  const totalPieces = qtyInUnit * piecesPerUnit;
  // CTA total reflects the buyer-facing price (sale if discounted).
  // The actual cart line still stores `product.unit_price` (the
  // original) — the cart engine re-applies the discount.
  const perPiecePrice = displayPrice ?? product.unit_price;
  const totalPrice = totalPieces * perPiecePrice;

  function switchUnit(next: Unit) {
    setUnit(next);
    setQtyInUnit(1);
  }

  function commitQtyDraft() {
    const trimmed = qtyDraft.trim();
    // Empty / invalid / zero — the buyer must add at least one of
    // something, so snap back to 1 rather than letting them submit a
    // no-op order line.
    if (trimmed === "") {
      setQtyDraft(String(qtyInUnit));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 1) {
      setQtyInUnit(1);
      setQtyDraft("1");
      return;
    }
    const floored = Math.floor(n);
    if (floored !== qtyInUnit) {
      setQtyInUnit(floored);
    } else {
      // Same number but possibly with leading zeros — re-normalize.
      setQtyDraft(String(floored));
    }
  }

  function describe(qty: number, u: Unit): string {
    if (u === "box") {
      const pieces = qty * piecesPerBox;
      return `${qty} хайрцаг (${pieces} ширхэг)`;
    }
    return `${qty} ширхэг`;
  }

  function handleAdd() {
    addToCart(product, totalPieces, scope);
    toast.success(`Сагсанд нэмлээ`, {
      description: `${product.name} · ${describe(qtyInUnit, unit)}`,
      action: { label: "Сагс үзэх", onClick: () => router.push(cartHref) },
    });
  }

  return (
    <div className="space-y-3">
      {/* Unit toggle — only when box count > 1. Animated pill matches the
          design's tiny pill switcher. */}
      {hasBox && (
        <div className="relative flex bg-muted rounded-full p-1 text-sm font-medium">
          <div
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow-sm transition-transform duration-200 ease-out",
              unit === "box" ? "translate-x-full" : "translate-x-0",
            )}
          />
          <button
            type="button"
            onClick={() => switchUnit("piece")}
            aria-pressed={unit === "piece"}
            className={cn(
              "relative z-10 flex-1 py-1.5 rounded-full text-[12px] font-semibold transition-colors",
              unit === "piece" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Ширхэг
          </button>
          <button
            type="button"
            onClick={() => switchUnit("box")}
            aria-pressed={unit === "box"}
            className={cn(
              "relative z-10 flex-1 py-1.5 rounded-full text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5",
              unit === "box" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Package className="h-3.5 w-3.5" />
            Хайрцаг
            <span className="text-[10.5px] font-normal text-muted-foreground">
              · {piecesPerBox}ш
            </span>
          </button>
        </div>
      )}

      {/* Stepper + Add CTA — sit on the same row. The stepper is a
          shrink-0 sized 48px control with a 2px border to read as a chunky
          input; the CTA flexes to fill the remaining width and shows the
          running total inline. */}
      <div className="flex items-stretch gap-2">
        <div className="flex-shrink-0">
          <div className="h-12 inline-flex items-stretch rounded-2xl border-2 border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setQtyInUnit(Math.max(1, qtyInUnit - 1))}
              disabled={qtyInUnit <= 1}
              aria-label="Хасах"
              className="px-3.5 hover:bg-muted disabled:opacity-40 active:scale-95 transition-all"
            >
              <Minus className="h-4 w-4" strokeWidth={2.4} />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={qtyDraft}
              onChange={(e) => {
                // Numeric-only — strip anything else as the user types.
                const cleaned = e.target.value.replace(/[^0-9]/g, "");
                setQtyDraft(cleaned);
              }}
              onFocus={(e) => e.target.select()}
              onBlur={commitQtyDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setQtyDraft(String(qtyInUnit));
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label="Тоо ширхэг"
              maxLength={4}
              // Explicit fixed width — without it the input inherits
              // HTML's default `size=20` (~150px) which pushes the
              // Сагсанд нэмэх CTA off-screen on narrow phones.
              className="w-12 px-1 text-center font-bold tabular-nums text-[15px] bg-transparent border-0 outline-none focus:bg-muted/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setQtyInUnit(qtyInUnit + 1)}
              aria-label="Нэмэх"
              className="px-3.5 hover:bg-muted active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] transition-all"
        >
          <span>Сагсанд нэмэх</span>
          <span className="text-primary-foreground/85 tabular-nums">
            · {formatMnt(totalPrice)}
          </span>
        </button>
      </div>
    </div>
  );
}
