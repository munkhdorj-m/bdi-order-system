"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * The root layout itself failed, so this replaces it: its own <html> and
 * <body>, no theme or fonts, plain enough to always render. Mongolian text
 * and a retry that fetches again (`unstable_retry`, Next 16).
 */
export default function GlobalError({
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
    <html lang="mn">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
          <h1 className="text-[20px] font-bold">Алдаа гарлаа</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Интернэт холболтоо шалгаад дахин оролдоно уу.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-6 h-12 w-full rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground"
          >
            Дахин оролдох
          </button>
          {/* A plain <a> on purpose: a full load, since the router may be what broke. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="mt-3 text-[14px] font-medium text-primary underline-offset-4 hover:underline">
            Нүүр хуудас руу
          </a>
        </main>
      </body>
    </html>
  );
}
