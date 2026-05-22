"use client";

import { ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  function handleChange(next: string) {
    const params = new URLSearchParams(search?.toString() ?? "");
    if (next === "name") params.delete("sort");
    else params.set("sort", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        aria-label="Эрэмбэлэх"
        className="gap-1 border-0 bg-transparent text-xs text-muted-foreground hover:text-foreground focus-visible:ring-0 focus-visible:border-0 px-1.5"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
