"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Last-resort error screen for pages without their own (the store and rep
 * areas have one). `unstable_retry` fetches the page again (Next 16) —
 * the usual cause is a weak connection.
 */
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
        <WifiOff className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <h1 className="text-[20px] font-bold">Хуудас ачаалж чадсангүй</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Интернэт холболтоо шалгаад дахин оролдоно уу.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Button size="lg" onClick={() => unstable_retry()}>
          <RotateCcw className="size-4" />
          Дахин оролдох
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">
            <Home className="size-4" />
            Нүүр хуудас руу
          </Link>
        </Button>
      </div>
    </div>
  );
}
