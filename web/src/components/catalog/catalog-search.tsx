"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Search, SearchX, X } from "lucide-react";
import { searchNormalize } from "@/lib/translit";
import { cn } from "@/lib/utils";

/**
 * Instant search inside the one-page catalog. Every product is already on
 * the page, so typing just hides the cards that don't match — no request,
 * no reload, and it works in Latin or Cyrillic ("tsaas" finds "цаас").
 *
 * How: the server hands over a tiny index (product → searchable text →
 * section). While there is a query, one <style> hides the cards and
 * sections that don't match. The cards themselves are untouched, so
 * quantities and cart state carry on as they were.
 */

export type CatalogIndexEntry = {
  /** product_id */
  id: string;
  /** Normalised text to search in: name, brand, code, category. */
  hay: string;
  /** The category section the product sits in. */
  section: string;
};

/** The "Өмнө авсан" section repeats products; it steps aside during a search. */
export const USUAL_SECTION_ID = "usual";

/** Fired by the header's search (store app) when the catalog is already open. */
export const CATALOG_SEARCH_EVENT = "bdi-catalog-search";

type SearchState = {
  query: string;
  setQuery: (q: string) => void;
  /** Matching products; null when not searching. */
  matches: number | null;
};

const CatalogSearchContext = createContext<SearchState | null>(null);

function useCatalogSearch(): SearchState {
  const ctx = useContext(CatalogSearchContext);
  if (!ctx) throw new Error("catalog search used outside CatalogSearchProvider");
  return ctx;
}

// Ids go into a CSS selector: only plain id characters are ever used.
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * The search term in the address bar — or null while the address still
 * shows the page we are arriving from (the address changes a moment after
 * the new page starts to draw).
 */
function addressQuery(basePath: string): string | null {
  if (window.location.pathname !== basePath) return null;
  return (new URLSearchParams(window.location.search).get("q") ?? "").trim();
}

function onAddressChange(notify: () => void) {
  // Back/Forward everywhere; where the browser has it, also every other
  // address change (a link to this same page, for one). That one fires in
  // the middle of the router's own work, so it is passed on a beat later.
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  const soon = () => queueMicrotask(notify);
  window.addEventListener("popstate", notify);
  nav?.addEventListener("currententrychange", soon);
  return () => {
    window.removeEventListener("popstate", notify);
    nav?.removeEventListener("currententrychange", soon);
  };
}

export function CatalogSearchProvider({
  index,
  initialQuery,
  basePath,
  children,
}: {
  index: CatalogIndexEntry[];
  /** `?q=` the page was opened with. */
  initialQuery: string;
  /** This catalog's path; the address is kept in step with the search box. */
  basePath: string;
  children: React.ReactNode;
}) {
  const [query, setQueryState] = useState(initialQuery);

  // The address is the truth for what is being searched; the box follows
  // it. The page itself can be older than its address: Back (say, from a
  // product) brings up the copy that was loaded before anything was typed,
  // while the address still carries the search — without this, the search
  // was simply gone.
  const inAddress = useSyncExternalStore(
    onAddressChange,
    // A new function on every draw, on purpose: React then reads the
    // address again right after each draw, which is when a link changes it.
    () => addressQuery(basePath),
    () => initialQuery,
  );
  const [seenInAddress, setSeenInAddress] = useState<string | null>(initialQuery);
  if (inAddress !== null && inAddress !== seenInAddress) {
    setSeenInAddress(inAddress);
    // Typing writes the address itself (below); then there is nothing to do.
    if (inAddress !== query.trim()) setQueryState(inAddress);
  }

  const { css, matches } = useMemo(() => {
    const tokens = searchNormalize(query).split(" ").filter(Boolean);
    if (tokens.length === 0) return { css: "", matches: null as number | null };
    const hidden: string[] = [];
    const liveSections = new Set<string>();
    const allSections = new Set<string>([USUAL_SECTION_ID]);
    let shown = 0;
    for (const e of index) {
      allSections.add(e.section);
      if (tokens.every((t) => e.hay.includes(t))) {
        shown++;
        liveSections.add(e.section);
      } else if (SAFE_ID.test(e.id)) {
        hidden.push(`[data-pid="${e.id}"]`);
      }
    }
    const deadSections = [...allSections]
      .filter((s) => !liveSections.has(s) && SAFE_ID.test(s))
      .map((s) => `[data-section="${s}"]`);
    const rules = [
      // The category rail has nothing to jump to while results are filtered.
      // (and a section's "N бараа" would count the hidden ones too)
      "[data-catalog-cats],[data-section-count]{display:none!important}",
      hidden.length ? `${hidden.join(",")}{display:none!important}` : "",
      deadSections.length ? `${deadSections.join(",")}{display:none!important}` : "",
    ];
    return { css: rules.join(""), matches: shown };
  }, [index, query]);

  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next);
      // Keep the address in step (Back, reload and sharing keep the search)
      // without asking the server for anything.
      const term = next.trim();
      const url = term ? `${basePath}?q=${encodeURIComponent(term)}` : basePath;
      window.history.replaceState(null, "", url);
    },
    [basePath],
  );

  // The store app's header search talks to the open catalog directly.
  useEffect(() => {
    const onSearch = (e: Event) => {
      setQuery(String((e as CustomEvent<string>).detail ?? ""));
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener(CATALOG_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(CATALOG_SEARCH_EVENT, onSearch);
  }, [setQuery]);

  const value = useMemo(() => ({ query, setQuery, matches }), [query, setQuery, matches]);

  return (
    <CatalogSearchContext.Provider value={value}>
      {css && <style>{css}</style>}
      {children}
    </CatalogSearchContext.Provider>
  );
}

/** The search box. Two are on the page (phone top, desktop sidebar); they share the query. */
export function CatalogSearchInput({ variant }: { variant: "mobile" | "desktop" }) {
  const { query, setQuery } = useCatalogSearch();
  const mobile = variant === "mobile";
  return (
    <div className="relative" role="search">
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          mobile ? "left-4 h-[18px] w-[18px]" : "left-3 h-4 w-4",
        )}
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
          // Results are already on screen: Enter just puts the keyboard away.
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="Бараа хайх: нэр, брэнд, код..."
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        aria-label="Бараа хайх"
        className={cn(
          "w-full [&::-webkit-search-cancel-button]:hidden",
          mobile
            ? "h-11 rounded-2xl bg-card pl-11 pr-11 text-[15px] shadow-sm ring-1 ring-border placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
            : "h-10 rounded-xl border border-transparent bg-muted/60 pl-9 pr-9 text-sm placeholder:text-muted-foreground/80 focus:border-primary/40 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15",
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Хайлтыг арилгах"
          className={cn(
            "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
            mobile ? "right-1 size-9" : "right-0.5 size-9",
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** "8 бараа олдлоо" above the results, or the nothing-found message. */
export function CatalogSearchStatus() {
  const { query, setQuery, matches } = useCatalogSearch();
  if (matches === null) return null;
  const term = query.trim();

  if (matches === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
          <SearchX className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
        </div>
        <p className="text-base font-semibold">«{term}» олдсонгүй</p>
        <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">
          Өөр үгээр хайж үзнэ үү, эсвэл ангиллаар нь харна уу.
        </p>
        <button
          type="button"
          onClick={() => setQuery("")}
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.98]"
        >
          Бүх бараа харах
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3" aria-live="polite">
      <p className="min-w-0 truncate text-[13px]">
        <span className="font-bold tabular-nums">{matches}</span>
        <span className="text-muted-foreground"> бараа олдлоо · «{term}»</span>
      </p>
      <button
        type="button"
        onClick={() => setQuery("")}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-card px-3.5 text-[13px] font-semibold ring-1 ring-border transition-colors hover:bg-accent/60"
      >
        <X className="h-4 w-4" /> Бүх бараа
      </button>
    </div>
  );
}
