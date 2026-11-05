"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, navSections } from "./nav-items";

/**
 * The admin menu on the night-sky rail: the current page is a gold tile,
 * the rest light up on hover. Shared by the desktop sidebar and the phone
 * drawer so both always match.
 */
export function AdminNavList() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {navSections.map((section, i) => (
        <div key={section.label ?? `top-${i}`} className={i > 0 ? "mt-5" : ""}>
          {section.label && (
            <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
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
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-[background-color,color] duration-150",
                      active
                        ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon
                      className={cn("h-[18px] w-[18px] shrink-0", !active && "opacity-80 group-hover:opacity-100")}
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
  );
}

/** "BDI" mark + name, for the top of the rail. */
export function AdminBrand() {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold font-display text-[13px] font-bold text-gold-foreground shadow-sm">
        B
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-[14px] font-semibold tracking-tight text-sidebar-foreground">
          BDI Admin
        </span>
        <span className="block truncate text-[11px] text-sidebar-foreground/60">Захиалгын систем</span>
      </span>
    </Link>
  );
}
