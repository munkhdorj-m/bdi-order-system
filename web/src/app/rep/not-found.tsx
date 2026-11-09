import Link from "next/link";
import { ChevronLeft, SearchX, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A store, product or order the rep can't open (not theirs any more,
 * taken off sale, an old link). Keeps the rep app's blue bar with a way
 * back to the store list.
 */
export default function RepNotFound() {
  return (
    <div>
      <header className="on-brand sticky top-0 z-10 flex h-14 items-center gap-2.5 bg-brand-bar px-2 text-brand-bar-foreground sm:px-4">
        <Link
          href="/rep"
          aria-label="Дэлгүүрийн жагсаалт руу буцах"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="text-[15px] font-semibold text-white">Олдсонгүй</span>
      </header>
      <main className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
          <SearchX className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
        </div>
        <h1 className="text-[20px] font-bold">Олдсонгүй эсвэл хандах эрхгүй</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Энэ дэлгүүр, бараа эсвэл захиалга танд харагдахгүй байна. Дэлгүүр өөр төлөөлөгчид шилжсэн байж магадгүй.
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/rep">
            <Store className="size-4" />
            Дэлгүүрийн жагсаалт
          </Link>
        </Button>
      </main>
    </div>
  );
}
