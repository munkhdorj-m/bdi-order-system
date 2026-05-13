"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogOut, Store } from "lucide-react";
import { BuyerBottomTabBar } from "./bottom-tab-bar";

type Props = {
  storeName: string;
  email: string | null;
  children: React.ReactNode;
};

// Top-level pages that anchor the bottom tab bar — no back button needed here.
const ROOT_PATHS = new Set(["/catalog", "/orders", "/cart"]);

export function BuyerShell({ storeName, email, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = ROOT_PATHS.has(pathname);

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-10 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center px-3 sm:px-4">
        {!isRoot ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-2 mr-1 p-2 rounded-md hover:bg-muted"
            aria-label="Буцах"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{storeName}</span>
          </div>
        )}

        <Link
          href="/catalog"
          className="ml-auto mr-1 font-semibold tracking-tight"
        >
          BDI
        </Link>

        <form action="/auth/signout" method="post" className="ml-1">
          <button
            type="submit"
            className="p-2 rounded-md hover:bg-muted"
            aria-label="Гарах"
            title={email ?? "Гарах"}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <BuyerBottomTabBar />
    </div>
  );
}
