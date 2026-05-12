import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function AdminProductsLoading() {
  return (
    <div className="max-w-6xl">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-20 sm:w-32 rounded-md" />
      </div>

      <Card className="mb-4 p-3 sm:p-4">
        <Skeleton className="h-10 w-full" />
      </Card>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-3 flex gap-3">
            <Skeleton className="size-14 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block">
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-4">
              <Skeleton className="size-12 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-32 hidden lg:block" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
