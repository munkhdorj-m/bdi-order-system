import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Modern admin form default: rounded-xl, comfortable padding,
        // relaxed line-height for reading prose. `field-sizing-content`
        // auto-grows the textarea up to its min-h. Hover + focus mirror
        // the Input primitive's treatment.
        "flex field-sizing-content min-h-20 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-[15px] leading-relaxed shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[14px] dark:bg-input/25 dark:disabled:bg-input/60 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
