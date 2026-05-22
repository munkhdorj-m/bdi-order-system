"use client";

import Link from "next/link";
import { useState } from "react";
import { Flame, Gift } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BonusCard,
  SaleCard,
  type DiscountCard,
} from "@/components/buyer/discount-hero";

/**
 * Buyer header entry-point for discounts. Replaces the inline catalog
 * hero — sits in the shell header next to the notifications bell and
 * stays reachable from every buyer page.
 *
 * Trigger: a size-9 icon button styled to match the bell, with a count
 * badge in the top-right corner when there's at least one active deal.
 *
 * Drawer: a `Sheet` opening from the right on `sm+` and from the
 * bottom on mobile, showing the two-section content (Хямдрал sales
 * then Бэлэг урамшуулал rewards). Cards stack vertically here — the
 * narrow sheet width makes horizontal scroll redundant, and stacking
 * lets the eye scan one card at a time.
 *
 * Empty state: when `count === 0` we still render the trigger (without
 * a badge) so the header layout stays stable; tapping shows a friendly
 * "no active discounts yet" placeholder with a CTA back to the catalog.
 */
export function DiscountsChip({
  cards,
  count,
}: {
  cards: DiscountCard[];
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const sales = cards.filter((c) => c.rule.kind === "product");
  const bonuses = cards.filter((c) => c.rule.kind === "threshold_bonus");

  function handleNavigate() {
    // Close the drawer before the router push so it doesn't linger
    // over the routed page.
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Хямдрал, бэлэг"
          className="relative size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all"
        >
          {/* Gift icon reads as "deals / freebies" instantly — clearer
              than a generic sparkle for users scanning the header. */}
          <Gift className="h-[18px] w-[18px]" strokeWidth={2} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[9.5px] font-bold tabular-nums flex items-center justify-center ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-[16px] font-bold tracking-tight">
            Хямдрал &amp; Бэлэг
          </SheetTitle>
          <p className="text-[12px] text-muted-foreground">
            {count > 0
              ? `Идэвхтэй санал · ${count}`
              : "Одоохондоо идэвхтэй санал алга"}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {sales.length === 0 && bonuses.length === 0 ? (
            <EmptyState onClose={handleNavigate} />
          ) : (
            <>
              {sales.length > 0 && (
                <DrawerSection
                  icon={
                    <Flame
                      className="h-3.5 w-3.5 text-rose-500"
                      strokeWidth={2.4}
                      fill="currentColor"
                    />
                  }
                  title="Хямдрал"
                  subtitle="Хязгаарлагдмал хугацаатай үнийн хямдрал"
                  count={sales.length}
                  accent="emerald"
                >
                  {sales.map((c) => (
                    <SaleCard
                      key={c.rule.id}
                      card={c}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </DrawerSection>
              )}
              {bonuses.length > 0 && (
                <DrawerSection
                  icon={
                    <Gift
                      className="h-3.5 w-3.5 text-amber-600"
                      strokeWidth={2.4}
                    />
                  }
                  title="Бэлэг урамшуулал"
                  subtitle="Босгонд хүрвэл үнэгүй бараа"
                  count={bonuses.length}
                  accent="amber"
                >
                  {bonuses.map((c) => (
                    <BonusCard
                      key={c.rule.id}
                      card={c}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </DrawerSection>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Drawer section header — same visual language as the old hero rail
// but stripped of the bleed margin / horizontal scroll wrapper. Cards
// inside stack vertically.
// ---------------------------------------------------------------------

function DrawerSection({
  icon,
  title,
  subtitle,
  count,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  accent: "emerald" | "amber";
  children: React.ReactNode;
}) {
  const countTone =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";

  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        {icon}
        <h3 className="text-[12px] uppercase tracking-[0.1em] font-bold">
          {title}
        </h3>
        <span
          className={`inline-flex items-center px-1.5 rounded-full text-[10px] font-bold tabular-nums ${countTone}`}
        >
          {count}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2.5 px-0.5">
        {subtitle}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Empty state — shown when there are zero active discount rules.
// ---------------------------------------------------------------------

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="size-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 text-muted-foreground">
        <Gift className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="text-[14px] font-bold tracking-tight">
        Одоохондоо хямдрал алга байна
      </h3>
      <p className="text-[12px] text-muted-foreground mt-1 max-w-[280px] mx-auto">
        Шинэ санал гарах үед энд гарч ирнэ.
      </p>
      <Link
        href="/catalog"
        onClick={onClose}
        className="inline-flex items-center mt-4 text-[12px] font-semibold text-primary hover:underline"
      >
        Каталог үзэх →
      </Link>
    </div>
  );
}
