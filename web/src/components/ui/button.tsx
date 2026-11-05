import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Soft rounded-rectangles (the "Тэнгэр ба алт" shape): easier to hit
  // than pills of the same height, and they line up with inputs and
  // selects. Every state is visible — hover lifts, press sinks, keyboard
  // focus gets a ring — and transitions are short so taps feel immediate.
  "inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-xl transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out outline-none select-none active:scale-[0.97] active:duration-75 disabled:opacity-45 disabled:pointer-events-none focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/92 hover:shadow-md hover:shadow-primary/25",
        /** The shopping action: add to cart, place order. */
        gold:
          "bg-gold text-gold-foreground shadow-sm shadow-gold/40 hover:brightness-[1.04] hover:shadow-md hover:shadow-gold/35",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline:
          "border border-input bg-card text-foreground shadow-[0_1px_1px_rgb(0_0_0/0.03)] hover:border-primary/35 hover:bg-accent/50 dark:hover:bg-accent/40",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/60",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-10 px-4 text-[14px]",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
