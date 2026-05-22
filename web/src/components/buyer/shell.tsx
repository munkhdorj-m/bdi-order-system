"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BuyerBottomTabBar } from "./bottom-tab-bar";
import { CatalogSearchTrigger } from "./catalog-search-trigger";

type Props = {
  storeName: string;
  email: string | null;
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
const ROOT_PATHS = new Set(["/catalog", "/orders", "/cart"]);

function storeInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "·";
}

export function BuyerShell({
  storeName,
  email,
  children,
  bell,
  dealsChip,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = ROOT_PATHS.has(pathname);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 h-14 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55">
        {/* Subtle brand-tinted hairline at the bottom — replaces the plain border
            with a gradient that picks up the brand color in the centre. */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="h-full flex items-center px-3 sm:px-4 gap-2">
          {!isRoot ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="-ml-1 size-9 rounded-xl flex items-center justify-center bg-muted/60 hover:bg-muted ring-1 ring-border/60 hover:ring-border active:scale-95 transition-all"
              aria-label="Буцах"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link
              href="/catalog"
              className="flex items-center gap-2 group/store min-w-0"
              aria-label={storeName}
            >
              <div className="relative size-9 rounded-xl bg-gradient-to-br from-primary to-primary/75 text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm shadow-primary/20 ring-1 ring-primary/30">
                {storeInitial(storeName)}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/15 pointer-events-none" />
              </div>
              <div className="flex flex-col items-start min-w-0 leading-tight">
                <span className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                  Дэлгүүр
                </span>
                <span className="text-[13px] font-semibold truncate max-w-[180px] sm:max-w-[260px] group-hover/store:text-primary transition-colors">
                  {storeName}
                </span>
              </div>
            </Link>
          )}

          <div className="ml-auto flex items-center gap-1">
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
                title={email ?? "Гарах"}
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
