"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addToCart, type CartScope } from "@/lib/cart";

export type ReorderLine = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
  unit_price: number;
};

/**
 * "Дахин захиалах" on the store's order page: puts every paid line of a
 * past order back into the store's cart, then opens /cart to review and
 * send. The cart page re-syncs each line with today's catalog (price,
 * category for deals, photo) as it opens, so old prices never stick.
 *
 * The cart adds up quantities per product, so a reorder lands on top of
 * whatever is already in the cart.
 */
export function ReorderButton({
  lines,
  scope,
  className,
}: {
  lines: ReorderLine[];
  /** The store's cart (`{ storeId, owner: "buyer" }`). */
  scope: CartScope;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Gift lines (0₮) came from a deal; they're re-earned at checkout, not
  // copied — otherwise they'd be charged at full price.
  const paid = lines.filter((l) => l.unit_price > 0);

  function handleClick() {
    startTransition(() => {
      for (const line of paid) {
        addToCart(
          {
            product_id: line.product_id,
            name: line.product_name_snapshot,
            brand: null,
            image_url: null,
            unit_price: line.unit_price,
          },
          line.qty,
          scope,
        );
      }
      toast.success(`${paid.length} бараа сагсанд орлоо`, {
        description: "Үнэ нь өнөөдрийн үнээр бодогдоно. Сагсаа нягтлаад илгээнэ үү.",
      });
      router.push("/cart");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || paid.length === 0}
      aria-busy={pending}
      className={
        className ??
        "flex-1 h-12 rounded-xl text-[14px] font-bold bg-gold text-gold-foreground shadow-sm shadow-gold/40 hover:brightness-[1.04] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ShoppingCart className="h-4 w-4" />
      )}
      Дахин захиалах
    </button>
  );
}
