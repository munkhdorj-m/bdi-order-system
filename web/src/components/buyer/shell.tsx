"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BuyerBottomTabBar } from "./bottom-tab-bar";
import { CatalogSearchTrigger } from "./catalog-search-trigger";

type Props = {
  storeName: string;
  /** Phone number to surface as the sign-out button's hover title.
   *  Lets a buyer confirm which account they're about to log out of. */
  phone: string | null;
  children: React.ReactNode;
  /** Slot for the notifications bell — passed in from the async parent
   *  layout so this client shell stays purely presentational. */
  bell?: React.ReactNode;
  /** Slot for the discounts chip (Sparkles icon + count badge). Same
   *  pattern as `bell`: the async parent layout fetches active discount
   *  rules and passes the rendered chip JSX in. Click opens a Sheet
   *  drawer with the two-section deals content. */
  dealsChip?: React.ReactNode;
};

// Top-level pages that anchor the bottom tab bar — no back button needed here.
const ROOT_PATHS = new Set(["/catalog", "/orders", "/cart", "/contact"]);

function storeInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "·";
}

export function BuyerShell({
  storeName,
  phone,
  children,
  bell,
  dealsChip,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = ROOT_PATHS.has(pathname);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Blue brand bar with the gold хээ trim. `on-brand` restyles the
          shared header widgets (bell, deals, theme, search) for it. */}
      <header className="on-brand haee-trim sticky top-0 z-20 h-14 bg-brand-bar text-brand-bar-foreground shadow-[0_6px_18px_-12px_rgb(15_25_60/0.5)] [--badge-ring:var(--brand-bar)]">
        {/* Flex layout: left-cluster takes leftover width (truncates the
            store name), right-cluster is `shrink-0` so icons never get
            squeezed. */}
        <div className="h-full flex items-center px-2 sm:px-4 gap-2 pb-[3px]">
          {!isRoot ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="shrink-0 -ml-1 size-10 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/15 active:scale-95 transition-all"
              aria-label="Буцах"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              href="/catalog"
              className="flex items-center gap-2.5 min-w-0 flex-1 rounded-xl -ml-1 pl-1 pr-2 py-1"
              aria-label={storeName}
            >
              <div className="shrink-0 size-9 rounded-xl bg-gold text-gold-foreground flex items-center justify-center font-display font-bold text-[15px] shadow-sm ring-1 ring-black/5">
                {storeInitial(storeName)}
              </div>
              <div className="flex flex-col items-start min-w-0 leading-tight">
                <span className="font-display text-[10px] tracking-[0.08em] text-white/70">
                  BDI Захиалга
                </span>
                <span className="text-[14px] font-semibold truncate max-w-full text-white">
                  {storeName}
                </span>
              </div>
            </Link>
          )}

          {/* Right cluster — `shrink-0` so icons keep their full size,
              the store-name truncation absorbs all the squeeze. Tighter
              gap on mobile to fit the search + deals + bell + theme +
              logout row without overflow. */}
          <div className="ml-auto shrink-0 flex items-center gap-0.5 sm:gap-1">
            {/* Mobile only — desktop has the inline search on /catalog. */}
            <CatalogSearchTrigger />

            {dealsChip}

            {bell}

            <ThemeToggle variant="buyer" />

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all"
                aria-label="Гарах"
                title={phone ?? "Гарах"}
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <BuyerBottomTabBar />
    </div>
  );
}
