import Link from "next/link";
import { ClipboardList, SearchX, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A product, order or deal link that no longer leads anywhere (a product
 * taken off sale, an old notification). Shown inside the store app's own
 * header and tab bar, with a way on — never a dead end.
 */
export default function BuyerNotFound() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
        <SearchX className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <h1 className="text-[20px] font-bold">Олдсонгүй</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Энэ бараа эсвэл захиалга одоо байхгүй байна. Зарагдахаа больсон эсвэл холбоос хуучирсан байж магадгүй.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link href="/catalog">
            <ShoppingBag className="size-4" />
            Каталог руу
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/orders">
            <ClipboardList className="size-4" />
            Миний захиалгууд
          </Link>
        </Button>
      </div>
    </div>
  );
}
