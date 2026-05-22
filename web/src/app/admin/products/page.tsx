import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SearchParams = Promise<{ q?: string; category?: string; page?: string }>;

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

const PAGE_SIZE = 50;

function formatMnt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
}

function buildHref(params: { q?: string; category?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const category = sp.category ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // count:"exact" gives us the total for pagination chrome.
  let query = supabase
    .from("products")
    .select(
      "id, sku, name, brand, image_url, base_price, stock, active, categories(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (q) {
    const term = q.replace(/[%_]/g, "\\$&"); // escape ILIKE wildcards
    query = query.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`,
    );
  }
  // Radix Select can't bind to an empty value, so the dropdown emits "all"
  // when the user wants every category. Treat that as "no filter".
  if (category && category.length > 0 && category !== "all") {
    query = query.eq("category_id", category);
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const [{ data: products, count, error }, categories] = await Promise.all([
    query,
    getCategories(),
  ]);

  const rows = (products as unknown as ProductRow[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categoryQS = category && category !== "all" ? category : undefined;

  return (
    <div className="w-full">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Бараа</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString("mn-MN")} нийт
            {q || categoryQS ? " (шүүсэн)" : ""}
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
          <Select
            name="category"
            defaultValue={category && category.length > 0 ? category : "all"}
          >
            <SelectTrigger
              size="default"
              className="w-full sm:w-48 h-9"
            >
              <SelectValue placeholder="Бүх ангилал" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх ангилал</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {/* Mobile: card list (vertical layout, compact) */}
          <div className="sm:hidden space-y-2">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className="flex gap-3 bg-card ring-1 ring-border rounded-2xl p-3 hover:shadow-sm transition-shadow"
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

          {/* Desktop: 3-4 col card grid per Hi-Fi AdminProductsList */}
          <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.map((p) => {
              const out = p.stock <= 0;
              const low = !out && p.stock < 10;
              return (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}`}
                  className="rounded-2xl bg-card ring-1 ring-border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
                >
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        fill
                        sizes="240px"
                        quality={85}
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-xs">
                        —
                      </div>
                    )}
                    {out && (
                      <div
                        className="absolute top-2 left-2 text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                        style={{ background: "var(--chart-coral, oklch(0.7 0.18 30))" }}
                      >
                        Дууссан
                      </div>
                    )}
                    {low && (
                      <div className="absolute top-2 left-2 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full ring-1 ring-amber-300/60 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800/60">
                        Цөөн
                      </div>
                    )}
                    {!p.active && (
                      <div className="absolute top-2 right-2 text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full ring-1 ring-border">
                        Идэвхгүй
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    {p.brand && (
                      <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-primary line-clamp-1">
                        {p.brand}
                      </div>
                    )}
                    <div className="text-[12.5px] font-semibold leading-snug line-clamp-2 min-h-[2.4em] mt-0.5">
                      {p.name}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[14px] font-bold tabular-nums">
                        {formatMnt(p.base_price)}
                      </span>
                      <span
                        className={`text-[10.5px] font-semibold tabular-nums ${
                          out
                            ? "text-rose-600"
                            : low
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-muted-foreground"
                        }`}
                      >
                        Үлд: {p.stock}
                      </span>
                    </div>
                    {p.categories?.name && (
                      <div className="mt-1.5 text-[10.5px] text-muted-foreground truncate">
                        {p.categories.name}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-muted-foreground">
            {offset + 1}–{Math.min(offset + rows.length, total)} /{" "}
            {total.toLocaleString("mn-MN")}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link
                href={buildHref({ q, category: categoryQS, page: page - 1 })}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
              >
                <ChevronLeft className="h-4 w-4" />
                Өмнөх
              </Link>
            </Button>
            <span className="px-2 text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
            >
              <Link
                href={buildHref({ q, category: categoryQS, page: page + 1 })}
                aria-disabled={page >= totalPages}
                tabIndex={page >= totalPages ? -1 : undefined}
              >
                Дараах
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
