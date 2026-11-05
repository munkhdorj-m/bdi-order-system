"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Mobile-only search affordance. Lives in the buyer top nav but hidden on
 * `sm:` and up — desktop uses the inline search field on the catalog page
 * itself. Tap → top-side Sheet with a real text input + submit. Goes to
 * `/catalog?q=<term>`, which searches every category.
 */
export function CatalogSearchTrigger() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on open. Sheet handles focus trap, but it doesn't
  // know which control should claim focus first. Wait for the slide-in
  // animation to settle before grabbing focus or mobile Safari drops it.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    // Search covers every category; results come back best match first.
    router.push(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
    setOpen(false);
  }

  const currentQ = search?.get("q") ?? "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Бараа хайх"
        className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all sm:hidden"
      >
        <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>

      <SheetContent
        side="top"
        showCloseButton={false}
        className="p-0 max-h-[100dvh]"
      >
        <SheetTitle className="sr-only">Хайх</SheetTitle>
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-3 sm:px-4 h-14 bg-background"
        >
          <div className="relative flex items-center flex-1 h-10 rounded-full bg-muted/60 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/30 transition-all">
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              name="q"
              defaultValue={currentQ}
              placeholder="Бараа, бренд, SKU хайх..."
              autoComplete="off"
              className="flex-1 bg-transparent pl-10 pr-3 text-[15px] placeholder:text-muted-foreground/80 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground px-2 active:scale-95 transition-all"
            aria-label="Хаах"
          >
            <X className="h-5 w-5" />
          </button>
        </form>
        {currentQ && (
          <div className="px-3 sm:px-4 pb-3 pt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Одоогийн хайлт:</span>
            <span className="font-mono text-foreground">
              &ldquo;{currentQ}&rdquo;
            </span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
