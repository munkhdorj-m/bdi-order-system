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

  function handleClick() {
    startTransition(() => {
      for (const line of lines) {
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
      toast.success(`${lines.length} бараа сагсанд орлоо`, {
        description: "Сагсаа нягтлаад илгээнэ үү.",
      });
      router.push("/cart");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || lines.length === 0}
      aria-busy={pending}
      className={
        className ??
        "flex-1 h-11 rounded-2xl text-[13px] font-bold bg-primary text-primary-foreground shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-1.5"
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
