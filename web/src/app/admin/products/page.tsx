import Link from "next/link";
import Image from "next/image";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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

  const { data: products, error } = await query;
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  const rows = (products as unknown as ProductRow[]) ?? [];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Бараа</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Нийт {rows.length} бараа
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4" />
            Шинэ бараа
          </Link>
        </Button>
      </div>

      <Card className="mb-6 p-4">
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Барааны нэр, SKU, бренд..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            name="category"
            defaultValue={category ?? ""}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Бүх ангилал</option>
            {categories?.map((c) => (
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
        <Card className="p-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      <Card>
        {rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="mb-1">Бараа олдсонгүй.</p>
            <p className="text-sm">
              Шинэ бараа нэмэх эсвэл xlsx файлаас импорт хийнэ үү.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Нэр</TableHead>
                <TableHead>Ангилал</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Үнэ</TableHead>
                <TableHead className="text-right">Үлдэгдэл</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell>
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
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          —
                        </div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="block font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.brand && (
                      <div className="text-xs text-muted-foreground">{p.brand}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.categories?.name ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="text-right">{formatMnt(p.base_price)}</TableCell>
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
        )}
      </Card>
    </div>
  );
}
