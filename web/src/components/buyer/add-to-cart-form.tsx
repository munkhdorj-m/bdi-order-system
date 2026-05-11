"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Check } from "lucide-react";
import { addToCart, type CartItem } from "@/lib/cart";

type Props = {
  product: Omit<CartItem, "qty">;
};

export function AddToCartForm({ product }: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const router = useRouter();

  function handleAdd() {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleAddAndGoToCart() {
    addToCart(product, qty);
    router.push("/cart");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setQty(Math.max(1, qty - 1))}
          aria-label="Хасах"
          className="size-10 rounded-full border bg-background flex items-center justify-center hover:bg-muted"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 text-center text-lg font-medium bg-transparent border-0 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setQty(qty + 1)}
          aria-label="Нэмэх"
          className="size-10 rounded-full border bg-background flex items-center justify-center hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className={`w-full h-12 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
          added
            ? "bg-emerald-600 text-white"
            : "bg-primary text-primary-foreground hover:opacity-90"
        }`}
      >
        {added ? (
          <>
            <Check className="h-4 w-4" />
            Нэмэгдлээ
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" />
            Сагсанд нэмэх
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleAddAndGoToCart}
        className="w-full h-10 rounded-full border bg-background hover:bg-muted text-sm font-medium"
      >
        Сагс руу шилжих
      </button>
    </div>
  );
}
