"use client";

import { createContext, useContext, useState } from "react";
import { FileSpreadsheet, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tick orders in the admin order list and act on them together: print
 * their delivery notes or download them as Excel. The print page and the
 * export take a list of order ids (up to MAX_PICK at a time).
 */

/** The print page and the export take at most this many ids. */
const MAX_PICK = 300;

type Selection = {
  picked: Set<string>;
  set: (ids: string[], on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("OrderSelectionProvider missing");
  return ctx;
}

export function OrderSelectionProvider({ children }: { children: React.ReactNode }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const value: Selection = {
    picked,
    set: (ids, on) =>
      setPicked((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    clear: () => setPicked(new Set()),
  };
  return (
    <SelectionContext.Provider value={value}>
      {children}
      <OrderSelectionBar />
    </SelectionContext.Provider>
  );
}

/** One order's checkbox, inside a 40px tap target. */
export function SelectOrderCheckbox({ id, label }: { id: string; label: string }) {
  const { picked, set } = useSelection();
  return (
    <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={picked.has(id)}
        onChange={(e) => set([id], e.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

/** Ticks every order of a group (a day) at once. */
export function SelectManyCheckbox({ ids, label }: { ids: string[]; label: string }) {
  const { picked, set } = useSelection();
  const count = ids.filter((id) => picked.has(id)).length;
  const all = ids.length > 0 && count === ids.length;
  return (
    <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = count > 0 && !all;
        }}
        onChange={(e) => set(ids, e.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

/** Sticky bar at the bottom while anything is ticked. */
function OrderSelectionBar() {
  const { picked, clear } = useSelection();
  if (picked.size === 0) return null;
  const ids = [...picked];
  const tooMany = ids.length > MAX_PICK;
  const list = ids.join(",");

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:left-60">
      <div className="mx-auto max-w-6xl px-4 pb-3">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-xl ring-1 ring-border">
          <div className="mr-auto text-[13px]">
            <b className="tabular-nums">{ids.length}</b> захиалга сонгосон
            {tooMany && (
              <span className="ml-2 text-amber-700 dark:text-amber-400">
                Нэг удаад {MAX_PICK} хүртэл
              </span>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X className="h-4 w-4" />
            Болих
          </Button>
          {tooMany ? (
            <>
              <Button type="button" variant="outline" size="sm" disabled>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button type="button" size="sm" disabled>
                <Printer className="h-4 w-4" />
                Падаан хэвлэх
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={`/admin/export?orders=${list}`}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </a>
              </Button>
              <Button asChild size="sm">
                <a href={`/print/invoices?orders=${list}`} target="_blank" rel="noreferrer">
                  <Printer className="h-4 w-4" />
                  Падаан хэвлэх
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
