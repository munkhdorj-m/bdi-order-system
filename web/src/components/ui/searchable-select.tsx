"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
  /** Show a "— None —" option at the top that clears the selection. */
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  className?: string;
  disabled?: boolean;
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
 * filter is disabled via shouldFilter={false}) so matching is predictable:
 *
 *   - case- and accent-insensitive
 *   - multi-word, order-independent (each typed word must appear somewhere
 *     in label + description) — "хан уул" finds "Минии дэлгүүр, Хан-Уул"
 *   - substring (partial words match)
 *
 * If an option is in `options`, typing its name WILL surface it.
 */
export function SearchableSelect({
  name,
  options,
  defaultValue,
  placeholder = "Сонгох",
  searchPlaceholder = "Хайх...",
  emptyLabel = "Олдсонгүй",
  allowEmpty = false,
  emptyOptionLabel = "— Сонгоогүй —",
  className,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(defaultValue ?? "");
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
    const matches =
      tokens.length === 0
        ? indexed
        : indexed.filter(({ hay }) => tokens.every((t) => hay.includes(t)));
    return matches.slice(0, RENDER_CAP).map((m) => m.opt);
  }, [indexed, query]);

  const hiddenCount =
    query.trim().length === 0
      ? Math.max(0, options.length - RENDER_CAP)
      : 0;

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Reset the query when closing so reopening starts fresh.
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">
              {selected ? selected.label : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          {/* We own the filtering (the `filtered` array above); force cmdk
              to keep everything we render by scoring every item 1. Using
              the `filter` prop rather than `shouldFilter` because that's
              the one reliably forwarded through the shadcn wrapper — and
              our items' cmdk `value` is the UUID, which would never match
              the typed text if cmdk's own filter ran. */}
          <Command filter={() => 1}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {allowEmpty && query.trim().length === 0 && (
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      setValue("");
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === "" ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-muted-foreground italic">
                      {emptyOptionLabel}
                    </span>
                  </CommandItem>
                )}
                {filtered.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    onSelect={() => {
                      setValue(o.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === o.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{o.label}</div>
                      {o.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {o.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
                {hiddenCount > 0 && (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    +{hiddenCount} бусад — хайж нэрээ бичнэ үү
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
