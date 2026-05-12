"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addToCart, type CartItem, type CartScope } from "@/lib/cart";

type Props = {
  product: Omit<CartItem, "qty">;
  scope?: CartScope;
  cartHref?: string;
};

export function AddToCartForm({ product, scope, cartHref = "/cart" }: Props) {
  const [qty, setQty] = useState(1);
  const router = useRouter();

  function handleAdd() {
    addToCart(product, qty, scope);
    toast.success(`Сагсанд ${qty} ширхэг нэмлээ`, {
      description: product.name,
      action: {
        label: "Сагс үзэх",
        onClick: () => router.push(cartHref),
      },
    });
  }

  function handleAddAndGoToCart() {
    addToCart(product, qty, scope);
    router.push(cartHref);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setQty(Math.max(1, qty - 1))}
          aria-label="Хасах"
          className="size-10 rounded-full border bg-background flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
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
          className="size-10 rounded-full border bg-background flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full h-12 rounded-full font-medium text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
      >
        <ShoppingCart className="h-4 w-4" />
        Сагсанд нэмэх
      </button>

      <button
        type="button"
        onClick={handleAddAndGoToCart}
        className="w-full h-10 rounded-full border bg-background hover:bg-muted active:scale-[0.98] text-sm font-medium transition-all"
      >
        Сагсаа харах
      </button>
    </div>
  );
}
