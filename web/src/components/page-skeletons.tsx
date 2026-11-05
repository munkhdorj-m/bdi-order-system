import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Loading frames shown the instant a link is clicked, while the server
 * renders the page. Next.js prefetches these with each link, so they need
 * no network at click time — that's what makes navigation feel immediate.
 * Shapes roughly follow the real pages so nothing jumps when data arrives.
 */

/** Admin list pages: title, filter bar, table rows. */
export function AdminListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="max-w-6xl" aria-busy="true" aria-label="Ачаалж байна">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-72 max-w-full mb-6" />
      <Card className="mb-4 flex flex-row flex-wrap gap-2 p-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </Card>
      <Card className="gap-0 p-0">
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Admin detail pages: back link, title, main card + side card. */
export function AdminDetailSkeleton() {
  return (
    <div className="max-w-6xl" aria-busy="true" aria-label="Ачаалж байна">
      <Skeleton className="h-4 w-36 mb-4" />
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-4 w-40 mb-6" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <Card className="p-4">
            <Skeleton className="h-11 w-full" />
          </Card>
          <Card className="gap-0 p-0">
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card className="space-y-3 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-9 w-full" />
        </Card>
      </div>
    </div>
  );
}

/** Admin create/edit forms. */
export function AdminFormSkeleton() {
  return (
    <div className="max-w-3xl" aria-busy="true" aria-label="Ачаалж байна">
      <Skeleton className="h-4 w-36 mb-4" />
      <Skeleton className="h-8 w-56 mb-6" />
      <Card className="space-y-4 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}

/** Buyer / rep list pages (phone first): header + stacked cards. */
export function MobileListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4" aria-busy="true" aria-label="Ачаалж байна">
      <Skeleton className="h-7 w-40 mb-2" />
      <Skeleton className="h-4 w-56 mb-5" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Buyer / rep detail pages: summary card + line items. */
export function MobileDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4" aria-busy="true" aria-label="Ачаалж байна">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="mb-4 space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The rep app's blue top bar, so it doesn't blink away while loading. */
export function RepBarSkeleton() {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-2.5 bg-brand-bar px-2 sm:px-4" aria-hidden="true">
      <div className="size-10 rounded-xl bg-white/10 ring-1 ring-white/15" />
      <div className="space-y-1.5">
        <div className="h-3.5 w-36 rounded bg-white/25" />
        <div className="h-2.5 w-20 rounded bg-white/15" />
      </div>
    </div>
  );
}

/** Rep home: the blue header with its three numbers, then the store list. */
export function RepHomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Ачаалж байна">
      <div className="bg-brand-bar px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gold/70" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-16 rounded bg-white/20" />
              <div className="h-3.5 w-36 rounded bg-white/30" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[52px] rounded-xl bg-white/10 ring-1 ring-white/15" />
            ))}
          </div>
        </div>
      </div>
      <MobileListSkeleton rows={7} />
    </div>
  );
}
