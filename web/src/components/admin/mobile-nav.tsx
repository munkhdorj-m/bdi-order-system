"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminBrand, AdminNavList } from "./admin-nav-list";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer when navigation lands on a new route. Done as a
  // render-time adjustment ("storing information from previous renders"
  // per react.dev) instead of an effect — React re-renders immediately
  // before painting, so the drawer never flashes on the new page.
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="lg:hidden -ml-2 flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-muted active:scale-95"
          aria-label="Цэс"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      {/* Same night-sky rail as the desktop sidebar. */}
      <SheetContent
        side="left"
        className="flex w-72 flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-4">
          <SheetTitle className="sr-only">Цэс</SheetTitle>
          <AdminBrand />
        </SheetHeader>
        <AdminNavList />
      </SheetContent>
    </Sheet>
  );
}
