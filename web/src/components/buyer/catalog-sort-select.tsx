"use client";

import { ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type CatalogSortValue = "name" | "price-asc" | "price-desc";

const OPTIONS: ReadonlyArray<{ value: CatalogSortValue; label: string }> = [
  { value: "name", label: "Нэрээр" },
  { value: "price-asc", label: "Үнэ ↑" },
  { value: "price-desc", label: "Үнэ ↓" },
];

export function CatalogSortSelect({ value }: { value: CatalogSortValue }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(search?.toString() ?? "");
    const next = e.target.value as CatalogSortValue;
    if (next === "name") params.delete("sort");
    else params.set("sort", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="relative inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
      <ArrowUpDown className="h-3.5 w-3.5" />
      <span className="sr-only">Эрэмбэлэх</span>
      <select
        value={value}
        onChange={handleChange}
        className="appearance-none bg-transparent border-0 text-xs font-medium text-foreground focus:outline-none cursor-pointer pr-1"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
