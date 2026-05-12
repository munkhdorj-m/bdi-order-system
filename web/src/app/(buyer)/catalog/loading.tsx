import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div>
      <div className="sticky top-14 z-[5] bg-background border-b">
        <div className="px-3 sm:px-4 pt-3 pb-2 max-w-3xl mx-auto">
          <Skeleton className="h-10 w-full rounded-full" />
          <div className="flex gap-2 pt-3 pb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-full shrink-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 sm:px-4 py-4 max-w-3xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-background rounded-xl border overflow-hidden"
            >
              <Skeleton className="aspect-square rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex justify-between items-center pt-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="size-9 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
