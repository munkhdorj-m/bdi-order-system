"use client";

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
 */
export function CatalogCartControl({ product }: Props) {
  const cart = useCart();
  const current = cart.find((i) => i.product_id === product.product_id);
  const qty = current?.qty ?? 0;
  const inCart = qty > 0;

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
      <span
        key={qty}
        className="flex-1 flex items-center justify-center px-3 text-base font-bold tabular-nums min-w-12 animate-in fade-in zoom-in-95 duration-150"
      >
        {qty}
      </span>
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
