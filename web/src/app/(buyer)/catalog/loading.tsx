function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-muted/70 ${className}`}
    >
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

export default function CatalogLoading() {
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-background via-background to-muted/20">
      <div className="sticky top-14 z-[5] bg-background/75 backdrop-blur-2xl border-b border-border/50">
        <div className="px-3 sm:px-4 pt-3 pb-1 max-w-7xl mx-auto">
          <ShimmerBlock className="h-12 w-full rounded-full" />
          <div className="flex gap-2 pt-3 pb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[78px] flex flex-col items-center gap-1.5"
              >
                <ShimmerBlock className="size-14 rounded-2xl" />
                <ShimmerBlock className="h-2.5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 sm:px-4 py-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 px-0.5">
          <ShimmerBlock className="h-3 w-24" />
          <ShimmerBlock className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/70 bg-card overflow-hidden"
            >
              <ShimmerBlock className="aspect-square rounded-none" />
              <div className="px-3 pt-3 pb-2 space-y-1.5">
                <ShimmerBlock className="h-3 w-12" />
                <ShimmerBlock className="h-3 w-full" />
                <ShimmerBlock className="h-3 w-3/4" />
                <ShimmerBlock className="h-4 w-20 mt-1.5" />
              </div>
              <div className="px-3 pb-3">
                <ShimmerBlock className="h-10 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
