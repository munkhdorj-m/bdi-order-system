import Link from "next/link";
import { Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Any address the app doesn't have (and notFound() outside the store and
 * rep areas, which have their own). The installed app has no browser Back
 * button, so the page always offers a way home — "/" sends each person to
 * their own start page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="on-brand flex h-14 items-center bg-brand-bar px-4 text-brand-bar-foreground">
        <span className="font-display text-[15px] font-semibold text-white">BDI Захиалга</span>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center px-6 py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
          <SearchX className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
        </div>
        <h1 className="text-[20px] font-bold">Хуудас олдсонгүй</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Холбоос хуучирсан эсвэл буруу байна.
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/">
            <Home className="size-4" />
            Нүүр хуудас руу
          </Link>
        </Button>
      </main>
    </div>
  );
}
