import Link from "next/link";
import Image from "next/image";
import { PackageSearch, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { getCategories } from "@/lib/categories";
import { CatalogCartControl } from "@/components/buyer/catalog-cart-control";
import { CatalogCategoryRail } from "@/components/buyer/catalog-category-rail";
import {
  CatalogSortSelect,
  type CatalogSortValue,
} from "@/components/buyer/catalog-sort-select";
import { InCartBadge } from "@/components/buyer/in-cart-badge";
import { formatMnt } from "@/lib/format";

type SearchParams = Promise<{ q?: string; category?: string; sort?: string }>;

type PriceRow = {
  product_id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  category_id: string | null;
  effective_price: number;
  box_count: number | null;
};

const SORT_CONFIG: Record<
  CatalogSortValue,
  { column: string; ascending: boolean }
> = {
  name: { column: "name", ascending: true },
  "price-asc": { column: "effective_price", ascending: true },
  "price-desc": { column: "effective_price", ascending: false },
};

function parseSort(raw: string | undefined): CatalogSortValue {
  return raw === "price-asc" || raw === "price-desc" ? raw : "name";
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, category, sort: sortParam } = await searchParams;
  const sort = parseSort(sortParam);
  const session = await requireSession();
  const supermarketId = session.profile.supermarket_id!;

  const supabase = await createClient();

  const sortCfg = SORT_CONFIG[sort];
  let query = supabase
    .from("supermarket_prices")
    .select(
      "product_id, sku, name, brand, image_url, category_id, effective_price, box_count",
    )
    .eq("supermarket_id", supermarketId)
    .order(sortCfg.column, { ascending: sortCfg.ascending });

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`,
    );
  }
  if (category) query = query.eq("category_id", category);

  const [{ data: products }, cats] = await Promise.all([query, getCategories()]);

  const rows = (products as PriceRow[] | null) ?? [];
  const activeCategory = category
    ? (cats.find((c) => c.id === category) ?? null)
    : null;
  const hasFilters = Boolean(q || category);

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-background via-background to-muted/20">
      {/* Sticky filter chrome: search pill + icon-card category rail. */}
      <header className="sticky top-14 z-[5] bg-background/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55 border-b border-border/50">
        <div className="px-3 sm:px-4 pt-3 pb-1 max-w-7xl mx-auto">
          <form method="get" className="relative group">
            {/* Soft brand glow under the input that intensifies on focus. */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 blur-lg group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative flex items-center h-12 rounded-full bg-card border border-border/70 group-focus-within:border-primary/60 shadow-sm group-focus-within:shadow-md group-focus-within:shadow-primary/15 transition-all duration-200">
              <div className="pl-4 pr-2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </div>
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Бараа, бренд, SKU хайх..."
                className="flex-1 min-w-0 bg-transparent text-[15px] placeholder:text-muted-foreground/80 focus:outline-none"
              />
              {q ? (
                <Link
                  href={buildHref({ category, sort: sortParam })}
                  aria-label="Хайлт цэвэрлэх"
                  className="mr-1.5 size-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90 transition-all"
                >
                  <X className="h-4 w-4" />
                </Link>
              ) : (
                <div className="mr-3 text-[10.5px] text-muted-foreground/60 font-medium tabular-nums hidden sm:block">
                  {rows.length} бараа
                </div>
              )}
              {category && (
                <input type="hidden" name="category" defaultValue={category} />
              )}
              {sortParam && (
                <input type="hidden" name="sort" defaultValue={sortParam} />
              )}
            </div>
          </form>

          <CatalogCategoryRail
            categories={cats}
            activeId={category}
            q={q}
            sort={sortParam}
          />
        </div>
      </header>

      <div className="px-3 sm:px-4 py-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 px-0.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {rows.length}
            </span>{" "}
            бараа
            {activeCategory && (
              <>
                {" "}
                ·{" "}
                <span className="text-foreground/80">
                  {activeCategory.name}
                </span>
              </>
            )}
          </p>
          {rows.length > 1 && <CatalogSortSelect value={sort} />}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            q={q}
            categoryName={activeCategory?.name ?? null}
            hasFilters={hasFilters}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {rows.map((p, i) => (
              <ProductCard key={p.product_id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product: p,
  index,
}: {
  product: PriceRow;
  index: number;
}) {
  // Stagger card entrance, but cap the delay so the 100th card doesn't wait 3s.
  const delay = `${Math.min(index, 18) * 30}ms`;

  return (
    <div
      className="catalog-card-enter group flex flex-col rounded-2xl border border-border/70 bg-card overflow-hidden transition-all duration-300 ease-out md:hover:border-border md:hover:shadow-lg md:hover:shadow-foreground/5 md:hover:-translate-y-0.5"
      style={{ animationDelay: delay }}
    >
      <Link
        href={`/catalog/${p.product_id}`}
        className="flex flex-col flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl"
      >
        <div className="aspect-square bg-gradient-to-br from-muted/30 to-muted/60 relative overflow-hidden">
          <InCartBadge productId={p.product_id} />
          {p.image_url ? (
            <Image
              src={p.image_url}
              alt={p.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 180px"
              unoptimized
              className="object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
              <PackageSearch className="h-8 w-8" strokeWidth={1.4} />
            </div>
          )}
        </div>
        <div className="px-3 pt-3 pb-2 flex flex-col flex-1 gap-1">
          {p.brand && (
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-primary/90 line-clamp-1">
              {p.brand}
            </div>
          )}
          <div className="text-[13px] leading-snug line-clamp-2 min-h-[2.4rem] text-foreground/90">
            {p.name}
          </div>
          {p.box_count && (
            <div className="text-[11px] text-muted-foreground">
              Хайрцагт {p.box_count} ширхэг
            </div>
          )}
          <div className="text-[15px] font-bold tabular-nums tracking-tight mt-auto pt-1.5">
            {formatMnt(p.effective_price)}
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <CatalogCartControl
          product={{
            product_id: p.product_id,
            name: p.name,
            brand: p.brand,
            image_url: p.image_url,
            unit_price: p.effective_price,
          }}
        />
      </div>
    </div>
  );
}

function EmptyState({
  q,
  categoryName,
  hasFilters,
}: {
  q?: string;
  categoryName: string | null;
  hasFilters: boolean;
}) {
  return (
    <div className="py-20 flex flex-col items-center text-center">
      <div className="size-16 rounded-2xl bg-gradient-to-br from-muted/60 to-muted flex items-center justify-center mb-4 ring-1 ring-border">
        <PackageSearch
          className="h-7 w-7 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
      <p className="text-base font-semibold">
        {hasFilters ? "Тохирох бараа олдсонгүй" : "Бараа алга байна"}
      </p>
      {hasFilters && (q || categoryName) && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
          {q && (
            <>
              Хайлт: <span className="font-mono">&ldquo;{q}&rdquo;</span>
            </>
          )}
          {q && categoryName && <> · </>}
          {categoryName && <>Категори: {categoryName}</>}
        </p>
      )}
      {hasFilters && (
        <Link
          href="/catalog"
          className="inline-flex items-center mt-5 h-10 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
        >
          Шүүлтүүр арилгах
        </Link>
      )}
    </div>
  );
}

function buildHref({
  q,
  category,
  sort,
}: {
  q?: string;
  category?: string;
  sort?: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
}
