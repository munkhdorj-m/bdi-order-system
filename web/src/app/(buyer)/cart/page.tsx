"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  useCart,
  updateQty,
  removeFromCart,
  totalAmount,
  totalQty,
  clearCart,
  formatMnt,
  type CartItem,
} from "@/lib/cart";
import { placeOrder } from "./actions";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const liveCart = useCart();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [snapshot, setSnapshot] = useState<CartItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // While we're submitting (or already succeeded), freeze on the snapshot so
  // the items don't blink to zero before navigation finishes.
  const cart = pending || submitted ? (snapshot ?? liveCart) : liveCart;
  const total = totalAmount(cart);
  const qty = totalQty(cart);

  function handleSubmit() {
    setError(null);
    setSnapshot([...liveCart]);
    startTransition(async () => {
      const result = await placeOrder({
        items: liveCart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        notes: notes.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        setSnapshot(null);
        return;
      }
      setSubmitted(true);
      if (result.orderId) router.push(`/orders/${result.orderId}?new=1`);
      clearCart();
    });
  }

  if (liveCart.length === 0 && !submitted && !pending) {
    return (
      <div className="px-4 py-16 text-center max-w-md mx-auto">
        <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-lg font-semibold mb-1">Сагс хоосон байна</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Каталогоос бараа сонгож сагсандаа нэмнэ үү.
        </p>
        <Button asChild>
          <Link href="/catalog">Каталог руу</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto pb-40 lg:pb-32">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Миний сагс</h1>
        <p className="text-sm text-muted-foreground">{qty} ширхэг бараа</p>
      </div>

      <div className="space-y-2">
        {cart.map((item) => (
          <div
            key={item.product_id}
            className="bg-background border rounded-lg p-3 flex gap-3"
          >
            <div className="size-16 sm:size-20 rounded bg-muted relative shrink-0 overflow-hidden">
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.name}
                  fill
                  sizes="80px"
                  quality={85}
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              {item.brand && (
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {item.brand}
                </div>
              )}
              <Link
                href={`/catalog/${item.product_id}`}
                className="text-sm leading-tight line-clamp-2 hover:underline"
              >
                {item.name}
              </Link>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {formatMnt(item.unit_price)} × {item.qty} ={" "}
                  <span className="font-medium text-foreground">
                    {formatMnt(item.unit_price * item.qty)}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="inline-flex items-center border rounded-full">
                  <button
                    type="button"
                    onClick={() => updateQty(item.product_id, item.qty - 1)}
                    aria-label="Хасах"
                    className="size-7 flex items-center justify-center hover:bg-muted rounded-l-full"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-3 text-sm font-medium min-w-8 text-center">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.product_id, item.qty + 1)}
                    aria-label="Нэмэх"
                    className="size-7 flex items-center justify-center hover:bg-muted rounded-r-full"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product_id)}
                  aria-label="Хасах"
                  className="ml-auto p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <label htmlFor="notes" className="block text-sm font-medium mb-1.5">
          Тэмдэглэл (заавал биш)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Жишээ нь: Маргааш өглөө хүртэл хүргэх боломжтой бол хүргэнэ үү"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.08)] p-3 sm:p-4 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Нийт</div>
            <div className="text-lg font-semibold">{formatMnt(total)}</div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={pending || cart.length === 0}
            className="rounded-full px-6 h-11"
          >
            {pending ? "Илгээж байна..." : "Захиалга илгээх"}
          </Button>
        </div>
      </div>
    </div>
  );
}
