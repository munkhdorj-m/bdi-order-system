"use client";

import { useState } from "react";
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
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
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
          <Command
            filter={(value, search) => {
              // cmdk's default filter is fuzzy substring on `value`. We pass
              // label+description as the cmdk value (see CommandItem below)
              // so both fields are searched.
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {allowEmpty && (
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      setValue("");
                      setOpen(false);
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
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.description ?? ""}`}
                    onSelect={() => {
                      setValue(o.value);
                      setOpen(false);
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
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
