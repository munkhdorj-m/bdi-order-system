"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, navSections } from "./nav-items";

/**
 * Admin nav rail — light surface on the app's token palette so it stays
 * consistent with the rest of the chrome (and adapts to dark mode via
 * the same tokens). Active page = filled cobalt pill, matching the
 * app-wide pill shape language.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    // sticky + h-screen pins the rail to the viewport while the content
    // column scrolls; the nav inside has its own overflow-y-auto for
    // when the menu outgrows short screens.
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen">
      {/* Brand block */}
      <div className="h-14 flex items-center px-4 border-b">
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
          <span className="size-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary/75 text-primary-foreground flex items-center justify-center font-extrabold text-[13px] shadow-sm shadow-primary/20 ring-1 ring-primary/30">
            B
          </span>
          <span className="leading-tight min-w-0">
            <span className="block text-[13.5px] font-bold tracking-tight truncate">
              BDI Admin
            </span>
            <span className="block text-[10px] text-muted-foreground truncate">
              Захиалгын систем
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
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
                        "flex items-center gap-3 rounded-full px-3.5 py-2 text-[13.5px] transition-all",
                        active
                          ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon
                        className="h-4 w-4"
                        strokeWidth={active ? 2.4 : 2}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t text-[10.5px] text-muted-foreground/70">
        BDI Захиалгын систем
      </div>
    </aside>
  );
}
