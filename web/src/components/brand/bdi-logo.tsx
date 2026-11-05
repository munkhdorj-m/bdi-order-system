import { BDI_PATH, BDI_VIEWBOX } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The "BDI" letters alone, in the current text colour. */
export function BdiWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox={BDI_VIEWBOX} fill="currentColor" aria-hidden="true" className={cn("block h-auto", className)}>
      <path d={BDI_PATH} />
    </svg>
  );
}

// `w` is shared by the letters and the gold line under them.
const SIZES = {
  sm: { box: "size-9 rounded-xl", w: "w-[64%]", bar: "mt-[3px] h-[2px]" },
  md: { box: "size-12 rounded-[0.9rem]", w: "w-[62%]", bar: "mt-1 h-[3px]" },
  lg: { box: "size-16 rounded-[1.2rem]", w: "w-[60%]", bar: "mt-1.5 h-1" },
} as const;

/**
 * The app-icon tile: "BDI" on brand blue with a gold line under it — the
 * same picture as the phone's home-screen icon. `gold` swaps the colours
 * for dark surfaces (the admin side rail); `glass` sits on the blue
 * sign-in screens.
 */
export function BdiLogo({
  size = "sm",
  tone = "blue",
  className,
  label = "BDI",
}: {
  size?: keyof typeof SIZES;
  tone?: "blue" | "gold" | "glass";
  className?: string;
  /** Accessible name; pass "" when text next to it already says BDI. */
  label?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 flex-col items-center justify-center shadow-sm ring-1",
        tone === "blue" && "bg-brand-bar text-white ring-white/15",
        tone === "gold" && "bg-gold text-gold-foreground ring-black/5",
        // On the blue sign-in backdrop: frosted glass.
        tone === "glass" && "bg-white/15 text-white ring-white/30 shadow-lg shadow-black/10 backdrop-blur-md",
        s.box,
        className,
      )}
    >
      <BdiWordmark className={s.w} />
      <span
        className={cn(
          "block rounded-full",
          s.w,
          tone === "gold" ? "bg-gold-foreground/80" : "bg-gold",
          s.bar,
        )}
      />
    </span>
  );
}
