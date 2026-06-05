"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addToCart,
  updateQty,
  useCart,
  type CartItem,
} from "@/lib/cart";

type Props = {
  product: Omit<CartItem, "qty">;
};

/**
 * Catalog card's bottom action. Two visual states pulled from the Hi-Fi
 * "Confident" design:
 *   - empty: outlined white pill with a brand-blue plus icon. Hovering
 *     flips the whole thing to filled primary.
 *   - in cart: large filled-primary stepper with a digit big enough to be
 *     legible at thumb-distance, and a subtle inset+drop shadow combo to
 *     read as a tactile control rather than a flat block.
 *
 * The count between the -/+ buttons is an inline-editable input — tap
 * the number, type a new value, blur/Enter commits. Cart is the source
 * of truth so external changes (a +/- click, another tab, the cart
 * page) sync back into the draft via useEffect.
 */
export function CatalogCartControl({ product }: Props) {
  const cart = useCart();
  const current = cart.find((i) => i.product_id === product.product_id);
  const qty = current?.qty ?? 0;
  const inCart = qty > 0;

  // Local typing draft. Holds whatever the user types while the input
  // is focused; we only commit to the cart on blur or Enter. Without
  // this, every keystroke would either thrash the cart or fight the
  // user's typing as the cart re-renders.
  const [draft, setDraft] = useState<string>(String(qty));
  useEffect(() => {
    setDraft(String(qty));
  }, [qty]);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const wasEmpty = qty === 0;
    addToCart(product, 1);
    if (wasEmpty) {
      toast.success("Сагсанд нэмлээ", { description: product.name });
    }
  }

  function handleSub(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    updateQty(product.product_id, qty - 1);
  }

  function commitDraft() {
    const trimmed = draft.trim();
    // Empty / non-numeric → revert to current cart qty without writing.
    if (trimmed === "") {
      setDraft(String(qty));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(qty));
      return;
    }
    const floored = Math.floor(n);
    if (floored === qty) {
      // Re-normalize ("03" → "3") even when value didn't change
      setDraft(String(qty));
      return;
    }
    updateQty(product.product_id, floored);
    // updateQty(0) drops the row; useCart re-renders and our useEffect
    // syncs draft to the new qty. No need to setDraft here.
  }

  if (!inCart) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`${product.name} — сагсанд нэмэх`}
        className="group/btn w-full h-10 rounded-lg text-xs font-semibold border border-border bg-card hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-1.5"
      >
        <Plus className="h-4 w-4 text-primary group-hover/btn:text-primary-foreground transition-colors duration-200" />
        Нэмэх
      </button>
    );
  }

  return (
    <div
      className="flex items-stretch h-10 rounded-lg bg-primary text-primary-foreground overflow-hidden"
      style={{
        boxShadow:
          "0 1px 0 0 color-mix(in oklch, var(--primary) 30%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--primary) 30%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={handleSub}
        aria-label={qty === 1 ? "Сагсанаас хасах" : "Хасах"}
        className="px-2.5 flex items-center justify-center hover:bg-black/15 active:bg-black/20 active:scale-95 transition-all"
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => {
          // Strip anything non-numeric as the user types so we never
          // hold an invalid draft. Empty string is fine — handled at
          // commit time.
          const cleaned = e.target.value.replace(/[^0-9]/g, "");
          setDraft(cleaned);
        }}
        onFocus={(e) => {
          // Select all so a tap-and-type cleanly replaces the current
          // count instead of appending to it. Big UX win on mobile.
          e.target.select();
          e.stopPropagation();
        }}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(String(qty));
            (e.target as HTMLInputElement).blur();
          }
        }}
        onClick={(e) => {
          // The whole card is wrapped in a <Link> on /catalog —
          // stop the click from bubbling so tapping the input doesn't
          // navigate away to the product page.
          e.stopPropagation();
        }}
        aria-label={`${product.name} — тоо ширхэг`}
        // Width is min-w-12 to match the old span; max 4 digits is
        // plenty for any realistic order line.
        maxLength={4}
        className="flex-1 text-center px-2 text-base font-bold tabular-nums min-w-12 bg-transparent border-0 outline-none focus:bg-black/10 transition-colors caret-primary-foreground selection:bg-white/40"
      />
      <button
        type="button"
        onClick={handleAdd}
        aria-label="Нэмэх"
        className="px-2.5 flex items-center justify-center hover:bg-black/15 active:bg-black/20 active:scale-95 transition-all"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
