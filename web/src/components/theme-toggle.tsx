"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Variant = "buyer" | "admin";

/**
 * Tri-state theme picker (Light / Dark / System). The icon on the trigger
 * crossfades to whatever's currently resolved so it's always representative —
 * even when the user is on "System" and the OS is in dark mode the trigger
 * shows the moon.
 *
 * `variant="buyer"` matches the rounded-tile chrome in the buyer shell top
 * nav; `variant="admin"` is a quieter ghost button for the admin header.
 */
export function ThemeToggle({ variant = "admin" }: { variant?: Variant }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useTheme only resolves on the client. Render a placeholder during SSR so
  // the trigger size doesn't pop after hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const triggerClass =
    variant === "buyer"
      ? "relative size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all"
      : "relative size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Theme — Гэрэл/Харанхуй"
        className={triggerClass}
      >
        <Sun
          className={cn(
            "h-[18px] w-[18px] absolute transition-all duration-300",
            isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "h-[18px] w-[18px] absolute transition-all duration-300",
            isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0",
          )}
        />
        {/* Reserve layout — both icons are absolute */}
        <span className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          data-active={theme === "light"}
          className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
        >
          <Sun className="h-4 w-4" />
          Гэрэлтэй
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          data-active={theme === "dark"}
          className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
        >
          <Moon className="h-4 w-4" />
          Харанхуй
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          data-active={theme === "system"}
          className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
        >
          <Monitor className="h-4 w-4" />
          Системийн дагуу
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
