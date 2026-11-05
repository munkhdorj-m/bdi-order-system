"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Package, PackagePlus, Search, Store } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { navSections } from "@/components/admin/nav-items";
import { adminSearch, type SearchResults } from "@/app/admin/search-actions";
import { searchNormalize } from "@/lib/translit";
import { formatMnt } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGES = [
  { href: "/admin/orders/new", label: "Шинэ захиалга оруулах", icon: PackagePlus },
  ...navSections.flatMap((s) => s.items.map((i) => ({ href: i.href, label: i.label, icon: i.icon }))),
];

/**
 * Admin quick search — Ctrl+K (or "/") anywhere, or the search box in the
 * header. Jump to any page, or find an order by number, a store by name /
 * registry no. / phone, a product by name / code, and open it.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, startSearch] = useTransition();
  const latest = useRef("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search the database a moment after typing stops.
  useEffect(() => {
    const term = query.trim();
    latest.current = term;
    if (term.length < 2) return;
    const t = window.setTimeout(() => {
      startSearch(async () => {
        const r = await adminSearch(term);
        if (latest.current === term) setResults(r);
      });
    }, 180);
    return () => window.clearTimeout(t);
  }, [query]);

  const pages = useMemo(() => {
    const tokens = searchNormalize(query).split(" ").filter(Boolean);
    if (tokens.length === 0) return PAGES.slice(0, 8);
    return PAGES.filter((p) => {
      const hay = searchNormalize(p.label);
      return tokens.every((t) => hay.includes(t));
    });
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }

  const term = query.trim();
  const shown = term.length >= 2 ? results : null;
  const nothing =
    pages.length === 0 &&
    !!shown &&
    shown.orders.length + shown.stores.length + shown.products.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-input bg-card px-3 text-[14px] text-muted-foreground shadow-[0_1px_1px_rgb(0_0_0/0.03)] transition-colors hover:border-foreground/25 hover:text-foreground sm:w-64 lg:w-80"
        aria-label="Хайх (Ctrl+K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Захиалга, дэлгүүр, бараа хайх…</span>
        <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted-foreground lg:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setQuery("");
            setResults(null);
          }
        }}
        title="Хайх"
        description="Захиалга, дэлгүүр, бараа эсвэл хуудас хайх"
        className="sm:max-w-xl"
      >
        {/* We filter ourselves (server search + page list). */}
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Захиалгын дугаар, дэлгүүр, утас, бараа…"
          />
          <CommandList className="max-h-[min(60vh,28rem)] max-sm:max-h-[calc(var(--vv-h,100dvh)-5.5rem)]">
            {searching && term.length >= 2 && !shown && (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Хайж байна…
              </div>
            )}
            {nothing && <CommandEmpty>“{term}” олдсонгүй.</CommandEmpty>}

            {shown && shown.orders.length > 0 && (
              <CommandGroup heading="Захиалга">
                {shown.orders.map((o) => (
                  <CommandItem key={o.id} value={`order-${o.id}`} onSelect={() => go(`/admin/orders/${o.id}`)}>
                    <span className="font-mono text-[13px] font-semibold">{o.order_number}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.store}</span>
                    <OrderStatusPill status={o.status} />
                    <span className="w-24 text-right tabular-nums text-[13px]">{formatMnt(o.subtotal)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {shown && shown.stores.length > 0 && (
              <CommandGroup heading="Дэлгүүр">
                {shown.stores.map((s) => (
                  <CommandItem key={s.id} value={`store-${s.id}`} onSelect={() => go(`/admin/supermarkets/${s.id}`)}>
                    <Store className="text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-medium", !s.active && "text-muted-foreground line-through")}>{s.name}</span>
                      {s.detail && <span className="block truncate text-[12px] text-muted-foreground">{s.detail}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {shown && shown.products.length > 0 && (
              <CommandGroup heading="Бараа">
                {shown.products.map((p) => (
                  <CommandItem key={p.id} value={`product-${p.id}`} onSelect={() => go(`/admin/products/${p.id}`)}>
                    <Package className="text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-medium", !p.active && "text-muted-foreground")}>{p.name}</span>
                      {p.code && <span className="block truncate font-mono text-[11.5px] text-muted-foreground">{p.code}</span>}
                    </span>
                    {!p.active && <span className="text-[11px] text-muted-foreground">нуусан</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {pages.length > 0 && (
              <CommandGroup heading="Хуудас">
                {pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                      <Icon className="text-muted-foreground" />
                      <span className="flex-1">{p.label}</span>
                      <CornerDownLeft className="opacity-0 group-data-[selected=true]/command-item:opacity-60" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
