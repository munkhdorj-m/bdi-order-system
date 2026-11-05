"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearCart,
  removeFromCart,
  totalAmount,
  totalQty,
  useCart,
  type CartItem,
} from "@/lib/cart";
import { formatMnt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RepHeader } from "@/components/rep/rep-header";
import { CartStepper } from "@/components/catalog/cart-controls";
import { ProductPlaceholder, categoryVisual } from "@/lib/category-visual";
import { placeOrderForStore } from "@/app/rep/stores/[id]/cart/actions";
import { useCartPriceSync } from "@/components/catalog/use-cart-price-sync";
import { useCheckoutId } from "@/lib/checkout-id";

/**
 * A rep's cart for one store. The store's name is in the header and on
 * the send button, so an order can't quietly go to the wrong shop.
 */
export function RepCartView({
  storeId,
  storeName,
  prices,
}: {
  storeId: string;
  storeName: string;
  /** Today's price per product for this store — re-prices a saved cart. */
  prices?: Record<string, number>;
}) {
  const scope = useMemo(() => ({ storeId }), [storeId]);
  const liveCart = useCart(scope);
  useCartPriceSync(prices, storeId);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [snapshot, setSnapshot] = useState<CartItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const checkoutId = useCheckoutId();

  const cart = pending || submitted ? (snapshot ?? liveCart) : liveCart;
  const total = totalAmount(cart);
  const pieces = totalQty(cart);
  const catalogHref = `/rep/stores/${storeId}/catalog`;

  function handleSubmit() {
    setError(null);
    setSnapshot([...liveCart]);
    const items = liveCart.map((i) => ({ product_id: i.product_id, qty: i.qty }));
    const note = notes.trim() || null;
    // Same cart re-sent → same id → the server won't make a second order.
    const requestId = checkoutId(JSON.stringify([storeId, items, note]));
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof placeOrderForStore>>;
      try {
        result = await placeOrderForStore({ supermarketId: storeId, items, notes: note, requestId });
      } catch {
        // Dropped connection. Re-sending is safe: it can't make a second order.
        result = { error: "Холболт тасарлаа. Дахин илгээнэ үү — захиалга давхардахгүй." };
      }
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        setSnapshot(null);
        return;
      }
      setSubmitted(true);
      clearCart(scope);
      // replace: Back from the order shouldn't land on an empty cart.
      if (result.orderId) router.replace(`/rep/orders/${result.orderId}?new=1`);
    });
  }

  if (liveCart.length === 0 && !submitted && !pending) {
    return (
      <div>
        <RepHeader title={storeName} subtitle="Сагс" backHref={catalogHref} cartScope={scope} />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <ShoppingCart className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="mb-1 text-lg font-semibold">Сагс хоосон байна</h1>
          <p className="mb-6 text-sm text-muted-foreground">Каталогоос бараа сонгоно уу.</p>
          <Button asChild size="lg">
            <Link href={catalogHref}>
              <ShoppingBag className="size-4" />
              Каталог руу
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <RepHeader
        title={storeName}
        subtitle={`Сагс · ${cart.length} төрөл · ${pieces} ширхэг`}
        backHref={catalogHref}
        cartScope={scope}
      />

      <main className="mx-auto max-w-2xl px-3 py-4 pb-40 sm:px-4">
        <div className="space-y-2">
          {cart.map((item) => (
            <div key={item.product_id} className="flex gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-20">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill sizes="80px" className="object-cover" />
                ) : (
                  <ProductPlaceholder visual={categoryVisual({ name: "", icon: item.category_icon })} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {item.brand && (
                  <div className="text-[11px] font-bold uppercase tracking-wide text-primary">{item.brand}</div>
                )}
                <Link
                  href={`/rep/stores/${storeId}/catalog/${item.product_id}`}
                  className="line-clamp-2 text-[14px] font-medium leading-tight hover:underline"
                >
                  {item.name}
                </Link>
                <div className="mt-1 text-[12.5px] text-muted-foreground tabular-nums">
                  {formatMnt(item.unit_price)} × {item.qty} ={" "}
                  <span className="font-semibold text-foreground">{formatMnt(item.unit_price * item.qty)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-40">
                    <CartStepper
                      product={{
                        product_id: item.product_id,
                        name: item.name,
                        brand: item.brand,
                        image_url: item.image_url,
                        unit_price: item.unit_price,
                        category_id: item.category_id,
                        category_icon: item.category_icon,
                      }}
                      boxCount={null}
                      scope={scope}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeFromCart(item.product_id, scope);
                      toast(`«${item.name}» сагснаас хасагдлаа`);
                    }}
                    aria-label={`${item.name} — сагснаас хасах`}
                    className="ml-auto flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <label htmlFor="notes" className="mb-1.5 block text-sm font-medium">
            Тэмдэглэл (заавал биш)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="field h-auto min-h-20 py-2.5"
            placeholder="Жишээ нь: маргааш өглөө хүргэх"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </main>

      <div className="glass-strong fixed inset-x-0 bottom-0 z-20 border-t border-border px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-muted-foreground">Нийт</div>
            <div className="font-display text-[19px] font-semibold tabular-nums leading-tight">{formatMnt(total)}</div>
          </div>
          <Button
            variant="gold"
            size="lg"
            onClick={handleSubmit}
            disabled={pending || cart.length === 0}
            className="ml-auto min-w-0 flex-1 sm:flex-none"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="truncate">{pending ? "Илгээж байна..." : `«${storeName}»-д илгээх`}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
