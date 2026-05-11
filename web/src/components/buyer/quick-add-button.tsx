"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { addToCart, type CartItem } from "@/lib/cart";

type Props = {
  product: Omit<CartItem, "qty">;
};

export function QuickAddButton({ product }: Props) {
  const [added, setAdded] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Сагсанд нэмэх"
      className={`shrink-0 size-9 rounded-full flex items-center justify-center transition-colors ${
        added
          ? "bg-emerald-600 text-white"
          : "bg-primary text-primary-foreground hover:opacity-90"
      }`}
    >
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
    </button>
  );
}
