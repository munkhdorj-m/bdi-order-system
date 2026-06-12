"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, navSections } from "./nav-items";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Brand block — gradient tile + product name, mirrors the buyer
          shell's store avatar so the two surfaces read as one system. */}
      <div className="h-14 flex items-center px-4 border-b">
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
          <span className="size-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary/75 text-primary-foreground flex items-center justify-center font-bold text-[13px] shadow-sm shadow-primary/20 ring-1 ring-primary/30">
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
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/45">
                {section.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      {/* Accent bar — anchors the eye on the current page
                          even when scanning the rail peripherally. */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary" />
                      )}
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
    </aside>
  );
}
