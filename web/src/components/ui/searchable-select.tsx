"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchNormalize } from "@/lib/translit";
import { PHONE_QUERY, useMediaQuery, useVisualViewportVars } from "@/lib/viewport";

export type SelectOption = {
  value: string;
  label: string;
  /** Extra text shown smaller, also searchable. */
  description?: string;
};

type Props = {
  /** Name of the hidden input — what gets submitted with the surrounding form. */
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Heading of the full-screen picker on phones (defaults to the placeholder). */
  title?: string;
  /** Show a "— None —" option at the top that clears the selection. */
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Called whenever the selection changes ("" when cleared). */
  onValueChange?: (value: string) => void;
};

// Romanize (Cyrillic → Latin) + strip accents + collapse whitespace, so
// the picker is case-, accent-, AND script-insensitive: typing "habudai"
// finds "Хабудай", "kola" finds "Кола". See lib/translit.
const normalize = searchNormalize;

// How many matches to render at once. Filtering runs over ALL loaded
// options (so nothing is "missing"), but we only paint the top slice to
// keep the DOM light when the list is large.
const RENDER_CAP = 80;

/**
 * Searchable single-select. Filtering is SELF-CONTROLLED (cmdk's built-in
 * filter is disabled) so matching is predictable:
 *
 *   - case- and accent-insensitive
 *   - multi-word, order-independent (each typed word must appear somewhere
 *     in label + description) — "хан уул" finds "Минии дэлгүүр, Хан-Уул"
 *   - substring (partial words match)
 *
 * On a computer it's a dropdown. On a phone it opens full-screen with the
 * search box on top and the results sized to the space ABOVE the keyboard
 * — a dropdown there flips upward, half off the screen, and is hard to hit.
 */
export function SearchableSelect({
  name,
  options,
  defaultValue,
  placeholder = "Сонгох",
  searchPlaceholder = "Хайх...",
  emptyLabel = "Олдсонгүй",
  title,
  allowEmpty = false,
  emptyOptionLabel = "— Сонгоогүй —",
  className,
  disabled = false,
  onValueChange,
}: Props) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);
  const [value, setValueState] = useState<string>(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  // Precompute a normalized haystack per option once.
  const indexed = useMemo(
    () =>
      options.map((o) => ({
        opt: o,
        hay: normalize(`${o.label} ${o.description ?? ""}`),
      })),
    [options],
  );

  const filtered = useMemo(() => {
    const tokens = normalize(query).split(" ").filter(Boolean);
    if (tokens.length === 0) {
      // Nothing typed: the current pick first, so it's always in view.
      const rest = indexed.map((m) => m.opt).filter((o) => o.value !== value);
      const head = options.find((o) => o.value === value);
      return (head ? [head, ...rest] : rest).slice(0, RENDER_CAP);
    }
    return indexed
      .filter(({ hay }) => tokens.every((t) => hay.includes(t)))
      .slice(0, RENDER_CAP)
      .map((m) => m.opt);
  }, [indexed, options, query, value]);

  const hiddenCount =
    query.trim().length === 0 ? Math.max(0, options.length - RENDER_CAP) : 0;

  function changeOpen(next: boolean) {
    setOpen(next);
    // Reset the query when closing so reopening starts fresh.
    if (!next) setQuery("");
  }

  function choose(next: string) {
    setValueState(next);
    if (next !== value) onValueChange?.(next);
    changeOpen(false);
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        "w-full justify-between font-normal text-[14px] hover:bg-card data-[state=open]:border-primary data-[state=open]:ring-4 data-[state=open]:ring-ring/15 active:scale-100",
        !selected && "text-muted-foreground",
        className,
      )}
    >
      <span className="truncate">{selected ? selected.label : placeholder}</span>
      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
    </Button>
  );

  const items = (big: boolean) => (
    <>
      <CommandEmpty className={cn(big && "py-10 text-[15px] text-muted-foreground")}>{emptyLabel}</CommandEmpty>
      <CommandGroup className={cn(big && "p-1.5")}>
        {allowEmpty && query.trim().length === 0 && (
          <CommandItem
            value="__none__"
            onSelect={() => choose("")}
            className={cn(big && "min-h-12 py-3 text-[15px]")}
          >
            <Check className={cn("mr-1 h-4 w-4 text-primary", value === "" ? "opacity-100" : "opacity-0")} />
            <span className="text-muted-foreground italic">{emptyOptionLabel}</span>
          </CommandItem>
        )}
        {filtered.map((o) => {
          const isOn = value === o.value;
          return (
            <CommandItem
              key={o.value}
              value={o.value}
              onSelect={() => choose(o.value)}
              className={cn(
                big && "min-h-12 py-2.5 text-[15px]",
                isOn && "bg-primary/8 shadow-[inset_3px_0_0_var(--primary)]",
              )}
            >
              <Check className={cn("mr-1 h-4 w-4 shrink-0 text-primary", isOn ? "opacity-100" : "opacity-0")} />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate", isOn && "font-semibold")}>{o.label}</div>
                {o.description && (
                  <div className={cn("truncate text-muted-foreground", big ? "text-[12.5px]" : "text-xs")}>
                    {o.description}
                  </div>
                )}
              </div>
            </CommandItem>
          );
        })}
        {hiddenCount > 0 && (
          <div className="px-2.5 py-2 text-[12px] text-muted-foreground">
            +{hiddenCount} бусад — нэрээр нь хайна уу
          </div>
        )}
      </CommandGroup>
    </>
  );

  return (
    <>
      <input type="hidden" name={name} value={value} />
      {isPhone ? (
        <DialogPrimitive.Root open={open} onOpenChange={changeOpen}>
          <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
          {open && (
            <PhonePicker
              title={title ?? placeholder}
              searchPlaceholder={searchPlaceholder}
              query={query}
              onQueryChange={setQuery}
            >
              {items(true)}
            </PhonePicker>
          )}
        </DialogPrimitive.Root>
      ) : (
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
            align="start"
            collisionPadding={8}
          >
            {/* We own the filtering (the `filtered` array above); force cmdk
                to keep everything we render by scoring every item 1 — our
                items' cmdk `value` is the UUID, which would never match the
                typed text if cmdk's own filter ran. */}
            <Command filter={() => 1}>
              <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
              {/* Never taller than the room the dropdown actually has. */}
              <CommandList className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height,20rem)-3.5rem))]">
                {items(false)}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}

/**
 * Full-screen picker for phones. Sized to the visual viewport, so with the
 * keyboard up the search box stays on top and every result above the
 * keyboard is tappable. Dragging the list hides the keyboard to show more.
 */
function PhonePicker({
  title,
  searchPlaceholder,
  query,
  onQueryChange,
  children,
}: {
  title: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (q: string) => void;
  children: React.ReactNode;
}) {
  const vvRef = useVisualViewportVars<HTMLDivElement>();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <DialogPrimitive.Portal>
      {/* Covers the page (and gives the modal its scroll lock). */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background" />
      <DialogPrimitive.Content
        ref={vvRef}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="fixed inset-x-0 top-[var(--vv-top,0px)] z-50 flex h-[var(--vv-h,100dvh)] flex-col bg-background outline-none animate-in fade-in-0 slide-in-from-bottom-3 duration-200"
      >
        <Command filter={() => 1} className="min-h-0 flex-1 rounded-none! bg-background p-0">
          <div className="border-b border-border bg-card px-3 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-sm">
            <div className="flex h-11 items-center gap-2">
              <DialogPrimitive.Title className="min-w-0 flex-1 truncate font-display text-[16px] font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost" size="sm" className="-mr-1 shrink-0 text-[14px] text-primary">
                  Болих
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
              <CommandPrimitive.Input
                ref={inputRef}
                value={query}
                onValueChange={onQueryChange}
                placeholder={searchPlaceholder}
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-11 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-ring/15"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Хайлтыг арилгах"
                  onClick={() => {
                    onQueryChange("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          </div>
          <CommandList
            className="max-h-none min-h-0 flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)]"
            onTouchMove={() => {
              // Scrolling the results: drop the keyboard so more show.
              if (document.activeElement === inputRef.current) inputRef.current?.blur();
            }}
          >
            {children}
          </CommandList>
        </Command>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
