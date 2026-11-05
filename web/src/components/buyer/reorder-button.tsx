"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/lib/cart";

export type ReorderLine = {
  product_id: string;
  product_name_snapshot: string;
  qty: number;
  unit_price: number;
};

/**
 * "Дахин захиалах" button for the buyer order-detail page. Re-adds every
 * line from a past order back into the localStorage cart at the prices
 * captured on the original order (the snapshot is intentional — we don't
 * want today's catalog price silently overriding what the buyer reordered).
 * Then navigates to /cart so they can review + submit.
 *
 * Note: the cart store dedupes by product_id and accumulates qty, so
 * reordering twice in a row doubles the quantity rather than overwriting.
 * That matches buyer intent — "I want the same again, on top of whatever's
 * already in my cart."
 */
export function ReorderButton({
  lines,
  className,
}: {
  lines: ReorderLine[];
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
