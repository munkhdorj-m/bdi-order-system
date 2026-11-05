"use client";

import { useState } from "react";
import { Minus, Package, Plus, ShoppingCart } from "lucide-react";
import {
  addToCart,
  updateQty,
  useCart,
  type CartItem,
  type CartScope,
} from "@/lib/cart";
import { cn } from "@/lib/utils";

/**
 * Client pieces of a catalog product card. All take the cart `scope`, so the
 * same card works for a store's own cart (no scope), a rep's per-store cart
 * and the admin preview.
 */

function useQty(productId: string, scope?: CartScope): number {
  const cart = useCart(scope);
  return cart.find((i) => i.product_id === productId)?.qty ?? 0;
}

/** Card frame that turns brand-tinted once the product is in the cart. */
export function ProductCardShell({
  productId,
  scope,
  children,
  style,
}: {
  productId: string;
  scope?: CartScope;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const inCart = useQty(productId, scope) > 0;
  return (
    <div
      data-in-cart={inCart || undefined}
      style={style}
      className={cn(
        "catalog-card-enter group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ease-out",
        "bg-card ring-1 ring-border",
        "data-[in-cart]:bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))]",
        "data-[in-cart]:ring-2 data-[in-cart]:ring-[color-mix(in_oklch,var(--primary)_45%,transparent)]",
        "md:hover:shadow-lg md:hover:shadow-foreground/5",
      )}
    >
      {children}
    </div>
  );
}

/** Quantity bubble on the photo while the product is in the cart. */
export function InCartBadge({ productId, scope }: { productId: string; scope?: CartScope }) {
  const qty = useQty(productId, scope);
  if (qty === 0) return null;
  return (
    <div
      key={qty}
      className="absolute top-2 right-2 z-[1] h-7 min-w-7 px-2 rounded-full bg-gold text-gold-foreground text-[12px] font-bold tabular-nums flex items-center justify-center gap-1 shadow-md ring-2 ring-card animate-in fade-in zoom-in-50 duration-300"
      aria-label={`Сагсанд ${qty} ширхэг`}
    >
      <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
      {qty}
    </div>
  );
}

/**
 * "Хайрцагт 72ш" — and once at least a full box is in the cart, how many
 * boxes that is ("1 хайрцаг + 12ш"), so nobody has to divide in their head.
 */
export function PackLine({
  productId,
  boxCount,
  scope,
}: {
  productId: string;
  boxCount: number | null;
  scope?: CartScope;
}) {
  const qty = useQty(productId, scope);
  if (!boxCount || boxCount <= 1) return null;
  const boxes = Math.floor(qty / boxCount);
  const rest = qty % boxCount;
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[11px] leading-tight",
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

/**
 * Add button → −/qty/+ stepper, plus a box button that adds a whole carton
 * in one tap. The number is typeable: tap it, type, Enter.
 */
export function CartStepper({
  product,
  boxCount,
  scope,
  disabled = false,
  disabledLabel = "Дууссан",
}: {
  product: Omit<CartItem, "qty">;
  boxCount: number | null;
  scope?: CartScope;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const qty = useQty(product.product_id, scope);
  const box = boxCount && boxCount > 1 ? boxCount : null;

  // Typing draft, committed on blur / Enter. Re-synced when the cart
  // changes elsewhere (another card for the same product, the cart page).
  const [draft, setDraft] = useState(String(qty));
  const [prevQty, setPrevQty] = useState(qty);
  if (prevQty !== qty) {
    setPrevQty(qty);
    setDraft(String(qty));
  }

  if (disabled) {
    return (
      <div className="h-10 rounded-xl bg-muted/70 text-muted-foreground text-[12px] font-semibold flex items-center justify-center select-none">
        {disabledLabel}
      </div>
    );
  }

  // Cards sit inside a <Link>; keep taps on the controls from navigating.
  function stop(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function add(n: number, e: React.MouseEvent) {
    stop(e);
    addToCart(product, n, scope);
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

  return (
    <div className="flex items-stretch gap-1.5 h-10">
      {qty === 0 ? (
        <button
          type="button"
          onClick={(e) => add(1, e)}
          aria-label={`${product.name} — сагсанд нэмэх`}
          className="flex-1 min-w-0 rounded-xl bg-gold text-gold-foreground text-[13.5px] font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-gold/40 hover:brightness-[1.04] hover:shadow-md active:scale-[0.97] transition-[filter,box-shadow,transform] duration-150"
        >
          <ShoppingCart className="h-4 w-4 shrink-0" strokeWidth={2.3} />
          Нэмэх
        </button>
      ) : (
        <div className="flex-1 min-w-0 flex items-stretch rounded-xl bg-primary text-primary-foreground overflow-hidden shadow-sm shadow-primary/25">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              updateQty(product.product_id, qty - 1, scope);
            }}
            aria-label={qty === 1 ? "Сагснаас хасах" : "Нэгээр хасах"}
            className="w-8 shrink-0 flex items-center justify-center hover:bg-black/15 active:bg-black/25 transition-colors"
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
            onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => add(1, e)}
            aria-label="Нэгээр нэмэх"
            className="w-8 shrink-0 flex items-center justify-center hover:bg-black/15 active:bg-black/25 transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
      )}
      {box && (
        <button
          type="button"
          onClick={(e) => add(box, e)}
          title={`Нэг хайрцаг (${box}ш) нэмэх`}
          aria-label={`Нэг хайрцаг, ${box} ширхэг нэмэх`}
          className="w-11 shrink-0 rounded-xl border border-border bg-card text-foreground/80 flex flex-col items-center justify-center gap-0.5 leading-none hover:border-primary hover:text-primary active:scale-95 transition-all"
        >
          <Package className="h-4 w-4" strokeWidth={2.2} />
          <span className="text-[10px] font-bold tabular-nums">+{box}</span>
        </button>
      )}
    </div>
  );
}
