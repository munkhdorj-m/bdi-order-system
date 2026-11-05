import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Modern admin form default: 40px tall, rounded-xl, comfortable
        // padding. Hover gives a subtle border lift; focus uses the
        // ring-3 treatment so the field feels tactile. Dark mode gets
        // the same input-tinted background as Textarea for consistency.
        "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 py-2 text-[15px] shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow,background-color] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[14px] dark:bg-input/25 dark:disabled:bg-input/60 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
