"use client";

import { useState } from "react";
import { Minus, Package, Plus, ShoppingCart } from "lucide-react";
import {
  addToCart,
  updateQty,
  useCartQty,
  type CartItem,
  type CartScope,
} from "@/lib/cart";
import { cn } from "@/lib/utils";

/**
 * The client part of a catalog product card — ONE per card. It reads just
 * this product's quantity (useCartQty), so tapping "+" re-renders this card
 * and nothing else. All take the cart `scope`: a store's own cart, a rep's
 * per-store cart, or the admin preview.
 */

type Product = Omit<CartItem, "qty">;

/**
 * Card frame (gold once the product is in the cart), the quantity bubble
 * on the photo, the box line and the add / −qty+ controls. `children` is
 * the server-rendered link part (photo, name, price).
 */
export function ProductCardShell({
  product,
  boxCount,
  scope,
  disabled = false,
  children,
  style,
}: {
  product: Product;
  boxCount: number | null;
  scope?: CartScope;
  /** Sold out for a store: the controls become a "Дууссан" label. */
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const qty = useCartQty(product.product_id, scope);
  return (
    <div
      data-pid={product.product_id}
      data-in-cart={qty > 0 || undefined}
      style={style}
      className={cn(
        "catalog-card-enter group relative flex flex-col rounded-2xl overflow-hidden transition-[box-shadow,transform,background-color] duration-200 ease-out",
        "bg-card ring-1 ring-border/80 shadow-card dark:ring-border",
        // In the cart: the shopping colour (gold) frames the card.
        "data-[in-cart]:bg-[color-mix(in_oklch,var(--gold)_7%,var(--card))]",
        "data-[in-cart]:ring-2 data-[in-cart]:ring-gold/80",
        "md:hover:shadow-raised md:hover:-translate-y-0.5",
      )}
    >
      {qty > 0 && (
        // Sits on the photo (the card starts with it).
        <div
          key={qty}
          aria-hidden="true"
          className="pointer-events-none absolute top-2 right-2 z-[2] h-7 min-w-7 px-2 rounded-full bg-gold text-gold-foreground text-[12.5px] font-bold tabular-nums flex items-center justify-center gap-1 shadow-md ring-2 ring-card animate-in fade-in zoom-in-50 duration-300"
        >
          <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
          {qty}
        </div>
      )}
      {children}
      <div className="px-3 pb-3 flex flex-col gap-2">
        <PackLine qty={qty} boxCount={boxCount} />
        <StepperControls
          product={product}
          qty={qty}
          boxCount={boxCount}
          scope={scope}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * "Хайрцагт 72ш" — and once at least a full box is in the cart, how many
 * boxes that is ("1 хайрцаг + 12ш"), so nobody has to divide in their head.
 */
function PackLine({ qty, boxCount }: { qty: number; boxCount: number | null }) {
  if (!boxCount || boxCount <= 1) return null;
  const boxes = Math.floor(qty / boxCount);
  const rest = qty % boxCount;
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[12px] leading-tight",
        boxes > 0 ? "text-primary font-semibold" : "text-muted-foreground",
      )}
    >
      <Package className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate">
        {boxes > 0
          ? `${boxes} хайрцаг${rest > 0 ? ` + ${rest}ш` : ""}`
          : `Хайрцагт ${boxCount}ш`}
      </span>
    </div>
  );
}

/** Add button → −/qty/+ stepper, for places outside the catalog grid (rep cart). */
export function CartStepper({
  product,
  boxCount,
  scope,
  disabled = false,
  disabledLabel = "Дууссан",
}: {
  product: Product;
  boxCount: number | null;
  scope?: CartScope;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const qty = useCartQty(product.product_id, scope);
  return (
    <StepperControls
      product={product}
      qty={qty}
      boxCount={boxCount}
      scope={scope}
      disabled={disabled}
      disabledLabel={disabledLabel}
    />
  );
}

/**
 * Every button is at least 40px. With nothing in the cart: "Нэмэх" + a box
 * button that adds a whole carton. In the cart: − / typeable number / +
 * across the full width (room for 144 or 1440), and the carton button on
 * its own row below.
 */
function StepperControls({
  product,
  qty,
  boxCount,
  scope,
  disabled,
  disabledLabel = "Дууссан",
}: {
  product: Product;
  qty: number;
  boxCount: number | null;
  scope?: CartScope;
  disabled: boolean;
  disabledLabel?: string;
}) {
  const box = boxCount && boxCount > 1 ? boxCount : null;

  // Typing draft, committed on blur / Enter. Re-synced when the cart
  // changes elsewhere (the same product in "Өмнө авсан", the cart page).
  const [draft, setDraft] = useState(String(qty));
  const [prevQty, setPrevQty] = useState(qty);
  if (prevQty !== qty) {
    setPrevQty(qty);
    setDraft(String(qty));
  }

  if (disabled) {
    return (
      <div className="h-10 rounded-xl bg-muted/70 text-muted-foreground text-[13px] font-semibold flex items-center justify-center select-none">
        {disabledLabel}
      </div>
    );
  }

  function commit() {
    const n = Number(draft.trim());
    if (draft.trim() === "" || !Number.isFinite(n) || n < 0) {
      setDraft(String(qty));
      return;
    }
    const next = Math.floor(n);
    if (next === qty) setDraft(String(qty));
    else updateQty(product.product_id, next, scope);
  }

  const boxButton = box ? (
    <button
      type="button"
      onClick={() => addToCart(product, box, scope)}
      aria-label={`Нэг хайрцаг, ${box} ширхэг нэмэх`}
      className={cn(
        "shrink-0 h-10 rounded-xl border border-border bg-card text-foreground/80 flex items-center justify-center gap-1.5 font-bold tabular-nums hover:border-primary hover:text-primary active:scale-95 transition-all",
        qty === 0 ? "w-12 flex-col gap-0.5 text-[11px] leading-none" : "w-full text-[13px]",
      )}
    >
      <Package className="h-4 w-4" strokeWidth={2.2} />
      {qty === 0 ? `+${box}` : `+1 хайрцаг · ${box}ш`}
    </button>
  ) : null;

  if (qty === 0) {
    return (
      <div className="flex items-stretch gap-1.5 h-10">
        <button
          type="button"
          onClick={() => addToCart(product, 1, scope)}
          aria-label={`${product.name} — сагсанд нэмэх`}
          className="flex-1 min-w-0 rounded-xl bg-gold text-gold-foreground text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-gold/40 hover:brightness-[1.04] hover:shadow-md active:scale-[0.97] transition-[filter,box-shadow,transform] duration-150"
        >
          <ShoppingCart className="h-4 w-4 shrink-0" strokeWidth={2.3} />
          Нэмэх
        </button>
        {boxButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch h-10 rounded-xl bg-primary text-primary-foreground overflow-hidden shadow-sm shadow-primary/25">
        <button
          type="button"
          onClick={() => updateQty(product.product_id, qty - 1, scope)}
          aria-label={qty === 1 ? `${product.name} — сагснаас хасах` : "Нэгээр хасах"}
          className="w-10 shrink-0 flex items-center justify-center hover:bg-black/15 active:bg-black/25 transition-colors"
        >
          <Minus className="h-4 w-4" strokeWidth={2.6} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          size={1}
          maxLength={5}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setDraft(String(qty));
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={`${product.name} — тоо ширхэг`}
          className="flex-1 min-w-0 bg-transparent text-center text-[15px] font-bold tabular-nums outline-none focus:bg-black/10 caret-primary-foreground selection:bg-white/40"
        />
        <button
          type="button"
          onClick={() => addToCart(product, 1, scope)}
          aria-label="Нэгээр нэмэх"
          className="w-10 shrink-0 flex items-center justify-center hover:bg-black/15 active:bg-black/25 transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} />
        </button>
      </div>
      {boxButton}
    </div>
  );
}
