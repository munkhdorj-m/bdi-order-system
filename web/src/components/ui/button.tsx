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
        // Solid fills get a lit top edge and a darker bottom edge: a
        // tactile "key" that reads as pressable at a glance (2.0 look).
        default:
          "bg-primary bg-[linear-gradient(180deg,rgb(255_255_255/0.13),rgb(255_255_255/0)_55%)] text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.16),0_1px_2px_rgb(16_28_72/0.2),0_6px_14px_-8px_var(--primary)] hover:brightness-[1.06] active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]",
        /** The shopping action: add to cart, place order. */
        gold:
          "bg-gold bg-[linear-gradient(180deg,rgb(255_255_255/0.28),rgb(255_255_255/0)_55%)] text-gold-foreground shadow-[inset_0_-2px_0_rgb(120_70_0/0.22),0_1px_2px_rgb(120_70_0/0.2),0_6px_14px_-8px_var(--gold)] hover:brightness-[1.04] active:shadow-[inset_0_1px_2px_rgb(120_70_0/0.25)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline:
          "border border-input bg-card text-foreground shadow-[0_1px_2px_rgb(16_28_72/0.06)] hover:border-primary/40 hover:bg-accent/50 dark:hover:bg-accent/40",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/60",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.15)] hover:brightness-[1.05]",
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
