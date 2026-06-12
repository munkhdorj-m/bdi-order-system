"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";

type Variant = "buyer" | "admin";

/**
 * Light/dark theme toggle. Single click flips between the two states —
 * no system option (the app defaults to light and explicitly opts users
 * into dark mode). The icon crossfades on switch so the trigger is
 * always representative of the active theme.
 *
 * `variant="buyer"` matches the rounded-tile chrome in the buyer shell
 * top nav; `variant="admin"` is a quieter ghost button for the admin
 * header.
 */
export function ThemeToggle({ variant = "admin" }: { variant?: Variant }) {
  const { resolvedTheme, setTheme } = useTheme();
  // useTheme only resolves on the client — gate on mounted so the SSR
  // render (which doesn't know the theme) matches what hydration sees.
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";

  const triggerClass =
    variant === "buyer"
      ? "relative size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all"
      : "relative size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all";

  return (
    <button
      type="button"
      aria-label={isDark ? "Гэрэлтэй горим руу" : "Харанхуй горим руу"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
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
    </button>
  );
}
