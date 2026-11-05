"use client";

import Link from "next/link";
import { RotateCcw, Store, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A rep screen failed to load (weak signal in a shop, usually). Try again
 * or go back to the store list — carts are kept on the phone.
 */
export default function RepError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
        <WifiOff className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <h1 className="text-[20px] font-bold">Хуудас ачаалж чадсангүй</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Холболтоо шалгаад дахин оролдоно уу. Сагсанд байгаа бараа хадгалагдсан.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Button size="lg" onClick={reset}>
          <RotateCcw className="size-4" />
          Дахин оролдох
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/rep">
            <Store className="size-4" />
            Дэлгүүрийн жагсаалт
          </Link>
        </Button>
      </div>
    </div>
  );
}
