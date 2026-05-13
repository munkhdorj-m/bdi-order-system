import Link from "next/link";
import Image from "next/image";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = Promise<{ q?: string; category?: string }>;

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  base_price: number;
  stock: number;
  active: boolean;
  categories: { name: string } | null;
};

function formatMnt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      "id, sku, name, brand, image_url, base_price, stock, active, categories(name)",
    )
    .order("created_at", { ascending: false });

  if (q && q.trim().length > 0) {
    const term = q.trim();
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`);
  }
  if (category && category.length > 0) {
    query = query.eq("category_id", category);
  }

  const [{ data: products, error }, categories] = await Promise.all([
    query,
    getCategories(),
  ]);

  const rows = (products as unknown as ProductRow[]) ?? [];

  return (
    <div className="w-full">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Бараа</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Нийт {rows.length} бараа
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Шинэ бараа</span>
            <span className="sm:hidden">Шинэ</span>
          </Link>
        </Button>
      </div>

      <Card className="mb-4 p-3 sm:p-4">
        <form className="flex flex-col sm:flex-row gap-2 sm:gap-3 min-w-0">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Нэр, SKU, бренд..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            name="category"
            defaultValue={category ?? ""}
            className="w-full sm:w-auto sm:max-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring truncate"
          >
            <option value="">Бүх ангилал</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Хайх
          </Button>
        </form>
      </Card>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="mb-1">Бараа олдсонгүй.</p>
          <p className="text-sm">
            Шинэ бараа нэмэх эсвэл xlsx файлаас импорт хийнэ үү.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className="flex gap-3 bg-background border rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="size-14 rounded bg-muted relative shrink-0 overflow-hidden">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      sizes="56px"
                      quality={85}
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  {p.brand && (
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      {p.brand}
                    </div>
                  )}
                  <div className="text-sm font-medium leading-tight line-clamp-2">
                    {p.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <span className="font-mono truncate">{p.sku}</span>
                    {!p.active && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] shrink-0">
                        Идэвхгүй
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">
                    {formatMnt(p.base_price)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Үлд: {p.stock}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden sm:block">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Нэр</TableHead>
                  <TableHead className="w-48 hidden lg:table-cell">Ангилал</TableHead>
                  <TableHead className="w-36">SKU</TableHead>
                  <TableHead className="w-28 text-right">Үнэ</TableHead>
                  <TableHead className="w-20 text-right">Үлдэгдэл</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell className="align-top">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="block w-12 h-12 rounded bg-muted overflow-hidden relative"
                      >
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            sizes="48px"
                            quality={85}
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            —
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="align-top">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="block font-medium hover:underline truncate"
                        title={p.name}
                      >
                        {p.name}
                      </Link>
                      {p.brand && (
                        <div className="text-xs text-muted-foreground truncate">
                          {p.brand}
                        </div>
                      )}
                    </TableCell>
                    <TableCell
                      className="hidden lg:table-cell text-sm text-muted-foreground truncate"
                      title={p.categories?.name ?? undefined}
                    >
                      {p.categories?.name ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate" title={p.sku}>
                      {p.sku}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatMnt(p.base_price)}
                    </TableCell>
                    <TableCell className="text-right">{p.stock}</TableCell>
                    <TableCell>
                      {p.active ? (
                        <Badge variant="secondary">Идэвхтэй</Badge>
                      ) : (
                        <Badge variant="outline">Идэвхгүй</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
