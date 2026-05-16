import * as React from "react";

import { cn } from "@/lib/utils";

type CalloutTone = "success" | "error" | "warning" | "info";

const TONE_CLASS: Record<CalloutTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
};

export function Callout({
  tone = "info",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { tone?: CalloutTone }) {
  return (
    <div
      data-slot="callout"
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "rounded-md border p-3 text-sm",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
