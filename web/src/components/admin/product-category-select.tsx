"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setProductCategory } from "@/app/admin/categories/actions";
import { cn } from "@/lib/utils";

/** Move a product to another category right from the product list. */
export function ProductCategorySelect({
  productId,
  productName,
  value,
  categories,
  className,
}: {
  productId: string;
  productName: string;
  value: string | null;
  categories: { id: string; name: string }[];
  className?: string;
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [pending, start] = useTransition();

  return (
    <select
      value={current}
      disabled={pending}
      aria-label={`${productName} — ангилал`}
      onChange={(e) => {
        const next = e.target.value;
        const prev = current;
        setCurrent(next);
        start(async () => {
          const r = await setProductCategory(productId, next || null);
          if (r.error) {
            setCurrent(prev);
            toast.error(r.error);
            return;
          }
          const name = categories.find((c) => c.id === next)?.name;
          toast.success(name ? `«${name}» руу шилжлээ` : "Ангилалгүй болголоо", { description: productName });
        });
      }}
      className={cn(
        "field h-9 rounded-lg px-2 text-[13px] disabled:opacity-60",
        !current && "border-amber-400 text-amber-800 dark:text-amber-300",
        className,
      )}
    >
      <option value="">— Ангилалгүй —</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
