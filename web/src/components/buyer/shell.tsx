"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { adoptLegacyCart, type CartScope } from "@/lib/cart";
import { BuyerBottomTabBar } from "./bottom-tab-bar";
import { CatalogSearchTrigger } from "./catalog-search-trigger";
import { SignOutButton } from "./sign-out-button";

type Props = {
  storeName: string;
  /** The store's supermarket id — its cart on this phone is kept under it. */
  storeId: string;
  /** Phone number to surface as the sign-out button's hover title.
   *  Lets a buyer confirm which account they're about to log out of. */
  phone: string | null;
  children: React.ReactNode;
  /** Slot for the notifications bell — passed in from the async parent
   *  layout so this client shell stays purely presentational. */
  bell?: React.ReactNode;
  /** Slot for the discounts chip (Gift icon + count badge), rendered by
   *  the layout like `bell`. */
  dealsChip?: React.ReactNode;
};

// Top-level pages that anchor the bottom tab bar — no back button needed here.
const ROOT_PATHS = new Set(["/catalog", "/orders", "/cart", "/contact"]);

/** Where "Буцах" goes when there's no page to go back to. */
function parentPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 1 ? `/${parts.slice(0, -1).join("/")}` : "/catalog";
}

/**
 * Is there an earlier page of this app in the tab's history? Opened from
 * a push notification, a Telegram link or a restored app there isn't —
 * and the installed app has no browser Back button to fall back on.
 */
function canGoBack(): boolean {
  const nav = (window as unknown as { navigation?: { canGoBack?: unknown } }).navigation;
  if (nav && typeof nav.canGoBack === "boolean") return nav.canGoBack;
  return window.history.length > 1;
}

function storeInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "·";
}

export function BuyerShell({
  storeName,
  storeId,
  phone,
  children,
  bell,
  dealsChip,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = ROOT_PATHS.has(pathname);
  const cartScope = useMemo<CartScope>(() => ({ storeId, owner: "buyer" }), [storeId]);

  // Carts used to share one key on the phone; move an old one to this store.
  useEffect(() => {
    adoptLegacyCart({ storeId, owner: "buyer" });
  }, [storeId]);

  function goBack() {
    if (canGoBack()) router.back();
    else router.push(parentPath(pathname));
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Blue brand bar. `on-brand` restyles the
          shared header widgets (bell, deals, theme, search) for it. */}
      <header className="on-brand sticky top-0 z-20 h-14 bg-brand-bar text-brand-bar-foreground [--badge-ring:var(--brand-bar)]">
        {/* Flex layout: left-cluster takes leftover width (truncates the
            store name), right-cluster is `shrink-0` so icons never get
            squeezed. */}
        <div className="h-full flex items-center px-2 sm:px-4 gap-1.5">
          {!isRoot ? (
            <button
              type="button"
              onClick={goBack}
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
                <span className="font-display text-[11px] tracking-[0.06em] text-white/75">
                  BDI Захиалга
                </span>
                <span className="text-[14px] font-semibold truncate max-w-full text-white">
                  {storeName}
                </span>
              </div>
            </Link>
          )}

          {/* Right cluster — `shrink-0` so the 40px icons keep their size;
              the store name's truncation absorbs the squeeze. */}
          <div className="ml-auto shrink-0 flex items-center gap-0.5 sm:gap-1">
            {/* Mobile only — desktop has the inline search on /catalog. */}
            <CatalogSearchTrigger />

            {dealsChip}

            {bell}

            <ThemeToggle variant="buyer" />

            <SignOutButton title={phone ?? undefined} />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <BuyerBottomTabBar scope={cartScope} />
    </div>
  );
}
