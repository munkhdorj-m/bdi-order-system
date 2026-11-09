"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * An admin page or action failed (a lost connection, a database error).
 * Retry re-fetches the page from the server; the dashboard link is the
 * way out. The digest matches the entry in the server logs.
 */
export default function AdminError({
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
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
        <AlertTriangle className="h-7 w-7 text-destructive" strokeWidth={1.8} />
      </div>
      <h1 className="text-[20px] font-bold">Хуудсыг ачаалж чадсангүй</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Холболтоо шалгаад дахин оролдоно уу. Давтагдвал доорх кодыг хөгжүүлэгчид илгээнэ үү.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[12px] text-muted-foreground">Код: {error.digest}</p>
      )}
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={() => unstable_retry()}>
          <RotateCcw className="size-4" />
          Дахин оролдох
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/admin">
            <LayoutDashboard className="size-4" />
            Дашбоард руу
          </Link>
        </Button>
      </div>
    </div>
  );
}
