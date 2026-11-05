import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/** Counting the mirror takes a few seconds (~185k rows), so show the frame right away. */
export default function AdminMercuryLoading() {
  return (
    <div className="max-w-5xl">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-96 max-w-full mb-6" />

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-6">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-56" />
        </div>
      </Card>

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g}>
            <Skeleton className="h-3 w-24 mb-2" />
            <Card>
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-4">
                    <Skeleton className="h-4 w-48 flex-1" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-40 hidden sm:block" />
                    <Skeleton className="h-4 w-28 hidden md:block" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
