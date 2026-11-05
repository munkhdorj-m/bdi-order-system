"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock, Phone, Search, ShoppingCart, Store as StoreIcon, X } from "lucide-react";
import { useStoreCartSizes } from "@/lib/cart";
import { searchNormalize } from "@/lib/translit";
import { cn } from "@/lib/utils";

export type RepStore = {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  contact_phone: string | null;
  /** "3 цаг өмнө" / "Захиалга байхгүй" */
  lastLabel: string;
  /** No order for over a week. */
  warn: boolean;
};

function storeInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "•";
}

/**
 * The rep's stores: type to find one (name, phone, district — Latin or
 * Cyrillic), stores with an unsent cart on top, and an order button on
 * every row so starting an order is one tap.
 */
export function RepStoreList({ stores }: { stores: RepStore[] }) {
  const [q, setQ] = useState("");
  const carts = useStoreCartSizes();

  const indexed = useMemo(
    () =>
      stores.map((s) => ({
        s,
        hay: searchNormalize([s.name, s.contact_phone, s.district, s.address].filter(Boolean).join(" ")),
      })),
    [stores],
  );

  const shown = useMemo(() => {
    const tokens = searchNormalize(q).split(" ").filter(Boolean);
    const hits = tokens.length
      ? indexed.filter(({ hay }) => tokens.every((t) => hay.includes(t))).map((m) => m.s)
      : stores;
    // Unsent carts first — that's unfinished work.
    return [...hits].sort((a, b) => (carts[b.id] ? 1 : 0) - (carts[a.id] ? 1 : 0));
  }, [indexed, stores, q, carts]);

  const openCarts = Object.keys(carts).filter((id) => stores.some((s) => s.id === id)).length;

  return (
    <div>
      {stores.length > 6 && (
        <div className="sticky top-0 z-10 -mx-3 bg-background/92 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Дэлгүүр хайх — нэр, утас, дүүрэг"
              enterKeyHint="search"
              autoComplete="off"
              className="field h-11 pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
              aria-label="Дэлгүүр хайх"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Хайлтыг арилгах"
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {openCarts > 0 && !q && (
        <div className="mb-2 mt-1 flex items-center gap-2 px-1 text-[12.5px] font-medium text-amber-800 dark:text-amber-300">
          <ShoppingCart className="h-4 w-4" />
          {openCarts} дэлгүүрт илгээгээгүй сагс байна
        </div>
      )}

      {shown.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground">
          <StoreIcon className="mx-auto mb-3 h-9 w-9 opacity-40" />«{q}» олдсонгүй
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-6">
          {shown.map((s) => {
            const inCart = carts[s.id] ?? 0;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-2 rounded-2xl bg-card p-2 pr-2.5 ring-1 transition-shadow hover:shadow-md",
                  inCart ? "ring-gold/70 shadow-[inset_3px_0_0_var(--gold)]" : s.warn ? "ring-amber-300/70" : "ring-border",
                )}
              >
                <Link href={`/rep/stores/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5">
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl font-display text-[15px] font-bold",
                      s.warn
                        ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300/60 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800/60"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {storeInitial(s.name)}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold">{s.name}</span>
                      {s.warn && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={2.2} />}
                    </span>
                    {(s.district || s.contact_phone) && (
                      <span className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted-foreground">
                        {s.contact_phone && <Phone className="h-3 w-3 shrink-0" strokeWidth={2.2} />}
                        <span className="truncate">{[s.contact_phone, s.district].filter(Boolean).join(" · ")}</span>
                      </span>
                    )}
                    <span
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-[11.5px]",
                        s.warn ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                      )}
                    >
                      <Clock className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                      {s.lastLabel}
                    </span>
                  </span>
                </Link>
                {inCart > 0 ? (
                  <Link
                    href={`/rep/stores/${s.id}/cart`}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gold px-3 text-[13px] font-bold text-gold-foreground shadow-sm active:scale-[0.97]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Сагс · {inCart}
                  </Link>
                ) : (
                  <Link
                    href={`/rep/stores/${s.id}/catalog`}
                    className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-primary/8 px-3 text-[13px] font-semibold text-primary ring-1 ring-primary/15 active:scale-[0.97]"
                  >
                    Захиалах
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
