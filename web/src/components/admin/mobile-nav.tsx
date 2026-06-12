"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isActive, navSections } from "./nav-items";

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
          className="lg:hidden -ml-2 p-2 rounded-md hover:bg-muted"
          aria-label="Цэс"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      {/* Mirrors the desktop sidebar: light token surface, filled cobalt
          pill on the active page. */}
      <SheetContent
        side="left"
        className="w-64 p-0 bg-sidebar text-sidebar-foreground"
      >
        <SheetHeader className="h-14 px-5 border-b justify-center">
          <SheetTitle className="text-left text-base flex items-center gap-2.5">
            <span className="size-7 rounded-lg bg-gradient-to-br from-primary to-primary/75 text-primary-foreground flex items-center justify-center font-extrabold text-[12px]">
              B
            </span>
            BDI Admin
          </SheetTitle>
        </SheetHeader>
        <nav className="px-3 py-4 overflow-y-auto">
          {navSections.map((section, i) => (
            <div key={section.label ?? `top-${i}`} className={i > 0 ? "mt-5" : ""}>
              {section.label && (
                <div className="px-3.5 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/45">
                  {section.label}
                </div>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-all",
                          active
                            ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
