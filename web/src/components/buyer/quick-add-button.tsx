"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addToCart, type CartItem, type CartScope } from "@/lib/cart";

type Props = {
  product: Omit<CartItem, "qty">;
  scope?: CartScope;
};

export function QuickAddButton({ product, scope }: Props) {
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1, scope);
    toast.success("Сагсанд нэмлээ", {
      description: product.name,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Сагсанд нэмэх"
      className="shrink-0 size-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}
