"use client";

import { useEffect, useRef, useState } from "react";
import {
  ALL_PRODUCTS_VISUAL,
  CategoryIconTile,
  USUAL_PRODUCTS_VISUAL,
  categoryVisual,
  type CategoryVisual,
} from "@/lib/category-visual";
import { fastScrollTo } from "@/lib/scroll";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { sectionDomId } from "./section-id";

export type CatalogNavItem = {
  /** Section key; the section's DOM id is `sectionDomId(id)`. */
  id: string;
  name: string;
  icon: string | null;
  count: number;
  /** The "previously bought" section rather than a category. */
  usual?: boolean;
};

function visualOf(it: CatalogNavItem): CategoryVisual {
  return it.usual ? USUAL_PRODUCTS_VISUAL : categoryVisual(it);
}

/** Where content starts under the sticky chrome once the phone rail is stuck. */
function chromeBottom(sticky: HTMLElement | null): number {
  if (sticky && sticky.offsetParent !== null) {
    return (parseFloat(getComputedStyle(sticky).top) || 0) + sticky.offsetHeight;
  }
  return 72; // desktop: the rail is hidden, only the page header is sticky
}

function sectionTop(id: string, sticky: HTMLElement | null): number | null {
  const el = document.getElementById(sectionDomId(id));
  if (!el) return null;
  return el.getBoundingClientRect().top + window.scrollY - chromeBottom(sticky) - 6;
}

/**
 * Category navigation for the one-page catalog: a sticky picture rail on
 * phones (its first button opens every category as a grid) and a sidebar
 * listing them all on desktop. Tapping jumps to the category's section
 * (no page load); while scrolling, the category on screen lights up.
 */
export function CatalogNav({
  items,
  initialId,
  searchSlot,
  stickyTopClass = "top-14",
}: {
  items: CatalogNavItem[];
  /** Jump here on first render (e.g. `?category=` from a deal link). */
  initialId?: string;
  /** Desktop search box, rendered above the sidebar list. */
  searchSlot?: React.ReactNode;
  /** Tailwind `top-*` for the phone rail — the height of the page header. */
  stickyTopClass?: string;
}) {
  const [active, setActive] = useState<string | undefined>(initialId ?? items[0]?.id);
  const [gridOpen, setGridOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  // While a tap-triggered scroll runs, don't let the scroll spy flicker
  // through every section in between.
  const locked = useRef(false);
  const unlockTimer = useRef<number | undefined>(undefined);

  function lockSpy(ms: number) {
    locked.current = true;
    window.clearTimeout(unlockTimer.current);
    unlockTimer.current = window.setTimeout(() => {
      locked.current = false;
    }, ms);
  }

  useEffect(() => () => window.clearTimeout(unlockTimer.current), []);

  // Scroll spy: the active section is the last one whose top has passed
  // the line just under the sticky chrome.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      if (locked.current) return;
      const line = chromeBottom(stickyRef.current) + 12;
      let current = items[0]?.id;
      for (const it of items) {
        const el = document.getElementById(sectionDomId(it.id));
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = it.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  // Deep link (?category=…): start at that section.
  useEffect(() => {
    if (!initialId) return;
    const top = sectionTop(initialId, stickyRef.current);
    if (top === null) return;
    lockSpy(300);
    window.scrollTo({ top, behavior: "instant" });
  }, [initialId]);

  // Keep the active chip visible inside the horizontal rail.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !active) return;
    const chip = rail.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(active)}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  function jump(id: string) {
    const top = sectionTop(id, stickyRef.current);
    if (top === null) return;
    setActive(id);
    lockSpy(350);
    fastScrollTo(top);
  }

  if (items.length === 0) {
    return searchSlot ? <aside className="hidden lg:block lg:w-64 shrink-0">{searchSlot}</aside> : null;
  }

  return (
    <>
      {/* Phones / tablets: sticky picture rail. */}
      <div
        ref={stickyRef}
        className={cn(
          "lg:hidden sticky z-[5] -mx-3 sm:-mx-4 mb-3 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75",
          stickyTopClass,
        )}
      >
        <div
          ref={railRef}
          role="tablist"
          aria-label="Ангилал"
          className="relative flex gap-0.5 overflow-x-auto scrollbar-thin px-2 sm:px-3 pt-2 pb-1.5"
        >
          {/* Every category at once — no sliding through the rail. */}
          <RailButton
            label="Бүх ангилал"
            visual={ALL_PRODUCTS_VISUAL}
            active={gridOpen}
            onClick={() => setGridOpen(true)}
            ariaHaspopup
          />
          <span aria-hidden="true" className="my-2 w-px shrink-0 bg-border" />
          {items.map((it) => (
            <RailButton
              key={it.id}
              id={it.id}
              label={it.name}
              count={it.count}
              visual={visualOf(it)}
              active={it.id === active}
              onClick={() => jump(it.id)}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <Sheet open={gridOpen} onOpenChange={setGridOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          <SheetTitle className="px-4 pb-2 pt-3 text-base">Ангилал</SheetTitle>
          <div className="grid grid-cols-4 gap-x-1 gap-y-3 overflow-y-auto px-3 pb-5 sm:grid-cols-6">
            {items.map((it) => {
              const isActive = it.id === active;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    setGridOpen(false);
                    // Let the sheet start closing so the jump isn't hidden behind it.
                    requestAnimationFrame(() => jump(it.id));
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl p-1 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="relative">
                    <CategoryIconTile visual={visualOf(it)} size="lg" active={isActive} />
                    <Count n={it.count} />
                  </span>
                  <span className={cn("line-clamp-2 text-[11px] leading-[1.15]", isActive ? "font-bold" : "font-medium text-foreground/85")}>
                    {it.name}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: every category in a sidebar. */}
      <aside className="hidden lg:block lg:w-64 shrink-0">
        <div className="sticky top-[calc(3.5rem+1rem)] flex flex-col gap-3 max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin pb-4">
          {searchSlot}
          <nav aria-label="Ангилал" className="flex flex-col gap-0.5">
            <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-1 px-2">
              Ангилал
            </div>
            {items.map((it) => {
              const isActive = it.id === active;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => jump(it.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "h-10 px-1.5 rounded-xl flex items-center gap-2.5 text-left text-[13px] transition-colors",
                    isActive ? "bg-muted font-bold text-foreground" : "font-medium text-foreground/80 hover:bg-muted/60",
                  )}
                >
                  <CategoryIconTile visual={visualOf(it)} size="sm" active={isActive} />
                  <span className="flex-1 min-w-0 truncate">{it.name}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{it.count}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-background ring-1 ring-border text-[9.5px] font-bold tabular-nums text-muted-foreground flex items-center justify-center">
      {n}
    </span>
  );
}

function RailButton({
  id,
  label,
  count,
  visual,
  active,
  onClick,
  ariaHaspopup = false,
}: {
  id?: string;
  label: string;
  count?: number;
  visual: CategoryVisual;
  active: boolean;
  onClick: () => void;
  ariaHaspopup?: boolean;
}) {
  return (
    <button
      type="button"
      role={ariaHaspopup ? undefined : "tab"}
      aria-selected={ariaHaspopup ? undefined : active}
      aria-haspopup={ariaHaspopup ? "dialog" : undefined}
      data-nav-id={id}
      onClick={onClick}
      className="group shrink-0 w-[68px] flex flex-col items-center gap-1 rounded-xl py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="relative">
        <CategoryIconTile
          visual={visual}
          size="md"
          active={active}
          className={cn("transition-transform duration-200", active ? "scale-105 shadow-md" : "group-active:scale-95")}
        />
        {count !== undefined && <Count n={count} />}
      </span>
      <span
        className={cn(
          "text-[10.5px] leading-[1.15] text-center line-clamp-2 transition-colors",
          active ? "text-foreground font-bold" : "text-muted-foreground font-medium",
        )}
      >
        {label}
      </span>
    </button>
  );
}
