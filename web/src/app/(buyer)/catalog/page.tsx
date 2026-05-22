import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, PackageSearch, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { getCategories, type CategoryRow } from "@/lib/categories";
import { CatalogCartControl } from "@/components/buyer/catalog-cart-control";
import { CatalogCategoryRail } from "@/components/buyer/catalog-category-rail";
import { CatalogCategorySidebar } from "@/components/buyer/catalog-category-sidebar";
import {
  CatalogSortSelect,
  type CatalogSortValue,
} from "@/components/buyer/catalog-sort-select";
import { InCartBadge } from "@/components/buyer/in-cart-badge";
import { ProductCardShell } from "@/components/buyer/product-card-shell";
import { formatMnt } from "@/lib/format";
import {
  priceWithProductDiscount,
  type DiscountRule,
} from "@/lib/discount";

type SearchParams = Promise<{ q?: string; category?: string; sort?: string }>;

type PriceRow = {
  product_id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  category_id: string | null;
  effective_price: number;
  unit: string | null;
  pack_size: number | null;
  box_count: number | null;
};

/**
 * Renders a one-line pack/box hint like "уут · 8ш" or "хайрцагт 54ш",
 * combining the product's `unit`, `pack_size`, and `box_count`. We show
 * pack_size first (more relevant when the buyer's choosing how many to
 * add) and append box_count when it's a different/larger grouping.
 */
function formatPackHint(p: {
  unit: string | null;
  pack_size: number | null;
  box_count: number | null;
}): string | null {
  const unit = p.unit?.trim();
  const parts: string[] = [];
  if (p.pack_size && p.pack_size > 1) {
    parts.push(`${unit ?? "уут"} · ${p.pack_size}ш`);
  } else if (unit) {
    parts.push(unit);
  }
  if (p.box_count && p.box_count > 0 && p.box_count !== p.pack_size) {
    parts.push(`хайрцагт ${p.box_count}ш`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

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

  // Fetch chrome data only (cats are cached + tiny). The expensive products
  // query streams via Suspense below so the buyer sees the header + filter
  // rail immediately on cold loads.
  const cats = await getCategories();
  const activeCategory = category
    ? (cats.find((c) => c.id === category) ?? null)
    : null;
  const hasFilters = Boolean(q || category);

  // Suspense key — when filter inputs change, React swaps the children so the
  // skeleton re-shows during the next stream rather than holding stale rows.
  const streamKey = `${q ?? ""}|${category ?? ""}|${sort}`;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-background via-background to-muted/20">
      {/* Visually hidden — the search pill + category rail serve as the visible
          page heading, but screen readers + a11y tools need a real h1. */}
      <h1 className="sr-only">Каталог</h1>

      {/* Sticky filter chrome — shown on mobile / sm / md only. lg+ uses
          the vertical sidebar below instead. */}
      <header className="lg:hidden sticky top-14 z-[5] bg-background/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55 border-b border-border/50">
        <div className="px-3 sm:px-4 pt-2 pb-1.5">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <CatalogCategoryRail
                categories={cats}
                activeId={category}
                q={q}
                sort={sortParam}
              />
            </div>

            <form
              method="get"
              className="relative shrink-0 w-48 md:w-64 hidden sm:block"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Хайх..."
                autoComplete="off"
                className="w-full h-9 rounded-full bg-muted/60 border border-transparent pl-9 pr-8 text-sm placeholder:text-muted-foreground/80 focus:outline-none focus:bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
              />
              {q && (
                <Link
                  href={buildHref({ category, sort: sortParam })}
                  aria-label="Хайлт цэвэрлэх"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </Link>
              )}
              {category && (
                <input type="hidden" name="category" defaultValue={category} />
              )}
              {sortParam && (
                <input type="hidden" name="sort" defaultValue={sortParam} />
              )}
            </form>
          </div>
        </div>
      </header>

      {/* Desktop (lg+) layout — sidebar + content split. The sidebar has
          a sticky top offset matching the buyer top-nav (h-14) so it stays
          visible while the grid scrolls. No max-width — content fills the
          viewport; gutters scale up at larger breakpoints to keep edges
          breathing without re-introducing centered whitespace. */}
      <div className="px-3 sm:px-4 lg:px-6 xl:px-8 py-5 lg:flex lg:gap-6">
        <aside className="hidden lg:block lg:w-60 shrink-0">
          <div className="sticky top-[calc(3.5rem+1rem)] flex flex-col gap-4">
            <form method="get" className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Хайх..."
                autoComplete="off"
                className="w-full h-10 rounded-xl bg-muted/60 border border-transparent pl-9 pr-8 text-sm placeholder:text-muted-foreground/80 focus:outline-none focus:bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
              />
              {q && (
                <Link
                  href={buildHref({ category, sort: sortParam })}
                  aria-label="Хайлт цэвэрлэх"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <X className="h-4 w-4" />
                </Link>
              )}
              {category && (
                <input type="hidden" name="category" defaultValue={category} />
              )}
              {sortParam && (
                <input type="hidden" name="sort" defaultValue={sortParam} />
              )}
            </form>

            <CatalogCategorySidebar
              categories={cats}
              activeId={category}
              q={q}
              sort={sortParam}
            />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <Suspense key={streamKey} fallback={<ProductGridSkeleton />}>
            <ProductGrid
              q={q}
              category={category}
              sort={sort}
              activeCategory={activeCategory}
              hasFilters={hasFilters}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ProductGrid({
  q,
  category,
  sort,
  activeCategory,
  hasFilters,
}: {
  q?: string;
  category?: string;
  sort: CatalogSortValue;
  activeCategory: CategoryRow | null;
  hasFilters: boolean;
}) {
  const session = await requireSession();
  const supermarketId = session.profile.supermarket_id!;
  const supabase = await createClient();

  const sortCfg = SORT_CONFIG[sort];
  let query = supabase
    .from("supermarket_prices")
    .select(
      "product_id, sku, name, brand, image_url, category_id, effective_price, unit, pack_size, box_count",
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

  const [{ data: products }, { data: discountRows }] = await Promise.all([
    query,
    // Pull only kind='product' rules — the catalog page just needs them
    // for the per-product sale badges on individual product cards. The
    // full deals catalog (sales + threshold-bonus rewards) lives in the
    // header chip drawer (`<DiscountsChip>`) and is fetched by the
    // buyer layout, so we don't duplicate that work here.
    supabase
      .from("discounts")
      .select(
        "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, ends_at",
      )
      .eq("kind", "product"),
  ]);
  const rows = (products as PriceRow[] | null) ?? [];
  const rules = (discountRows as unknown as DiscountRule[] | null) ?? [];

  return (
    <>
      {/* Hi-Fi spec: bold tabular count + muted "бараа" trail, sort pill
          on the right. Tighter than the previous "12 бараа · Категори" line. */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <p className="text-[13px]">
          <span className="font-bold tabular-nums">{rows.length}</span>
          <span className="text-muted-foreground"> бараа</span>
          {activeCategory && (
            <span className="text-muted-foreground"> · {activeCategory.name}</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {rows.map((p, i) => (
            <ProductCard
              key={p.product_id}
              product={p}
              index={i}
              // First 6 cards are above-the-fold across all breakpoints;
              // priority eager-loads them and makes the LCP image fast.
              priority={i < 6}
              rules={rules}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Skeleton shown while the products query streams. Mirrors the new grid shape
 * so the layout doesn't reflow when real cards drop in. Uses the same shimmer
 * utility as `loading.tsx` for visual continuity.
 */
function ProductGridSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-4 px-0.5">
        <div className="h-3 w-24 rounded-md bg-muted/70 relative overflow-hidden">
          <div className="shimmer absolute inset-0" />
        </div>
        <div className="h-3 w-16 rounded-md bg-muted/70 relative overflow-hidden">
          <div className="shimmer absolute inset-0" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/70 bg-card overflow-hidden"
          >
            <div className="aspect-square bg-muted/70 relative overflow-hidden">
              <div className="shimmer absolute inset-0" />
            </div>
            <div className="px-3 pt-3 pb-2 space-y-1.5">
              <div className="h-3 w-12 rounded bg-muted/70 relative overflow-hidden">
                <div className="shimmer absolute inset-0" />
              </div>
              <div className="h-3 w-full rounded bg-muted/70 relative overflow-hidden">
                <div className="shimmer absolute inset-0" />
              </div>
              <div className="h-3 w-3/4 rounded bg-muted/70 relative overflow-hidden">
                <div className="shimmer absolute inset-0" />
              </div>
              <div className="h-4 w-20 rounded bg-muted/70 mt-1.5 relative overflow-hidden">
                <div className="shimmer absolute inset-0" />
              </div>
            </div>
            <div className="px-3 pb-3">
              <div className="h-10 w-full rounded-lg bg-muted/70 relative overflow-hidden">
                <div className="shimmer absolute inset-0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ProductCard({
  product: p,
  index,
  priority = false,
  rules = [],
}: {
  product: PriceRow;
  index: number;
  priority?: boolean;
  rules?: DiscountRule[];
}) {
  // Stagger card entrance, but cap the delay so the 100th card doesn't wait 3s.
  const delay = `${Math.min(index, 18) * 30}ms`;
  const sale = priceWithProductDiscount(
    p.product_id,
    p.category_id,
    p.effective_price,
    rules,
  );
  const cartPrice = sale ? sale.net : p.effective_price;

  return (
    <ProductCardShell
      productId={p.product_id}
      style={{ animationDelay: delay }}
    >
      <Link
        href={`/catalog/${p.product_id}`}
        className="flex flex-col flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-3xl"
      >
        {/* Hi-Fi spec: aspect 4:3.4 (taller-than-square) on the image area. */}
        <div className="aspect-[4/3.4] bg-gradient-to-br from-muted/30 to-muted/60 relative overflow-hidden">
          <InCartBadge productId={p.product_id} />
          {p.image_url ? (
            <Image
              src={p.image_url}
              alt={p.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 180px"
              unoptimized
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              className="object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
              <PackageSearch className="h-8 w-8" strokeWidth={1.4} />
            </div>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1 gap-1.5">
          {p.brand && (
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-primary line-clamp-1">
              {p.brand}
            </div>
          )}
          <div className="text-[13.5px] font-semibold leading-snug line-clamp-2 min-h-[2.4rem]">
            {p.name}
          </div>
          {sale ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[17px] font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                {formatMnt(sale.net)}
              </span>
              <span className="text-[11px] tabular-nums line-through text-muted-foreground/70">
                {formatMnt(p.effective_price)}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500 text-white">
                −{sale.pct}%
              </span>
            </div>
          ) : (
            <div className="text-[17px] font-bold tabular-nums tracking-tight">
              {formatMnt(p.effective_price)}
            </div>
          )}
          {(() => {
            const hint = formatPackHint(p);
            return hint ? (
              <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <Package className="h-3 w-3" strokeWidth={2} />
                {hint}
              </div>
            ) : null;
          })()}
        </div>
      </Link>
      <div className="px-3 pb-3 pt-1">
        <CatalogCartControl
          product={{
            product_id: p.product_id,
            name: p.name,
            brand: p.brand,
            image_url: p.image_url,
            // Push the ORIGINAL list price into the cart so the
            // discount engine can itemize the per-product discount as
            // its own line in the cart breakdown. Avoids
            // double-counting: catalog shows the strikethrough +
            // emerald net price already, and cart re-derives the same
            // number via lib/discount.ts.
            unit_price: p.effective_price,
            category_id: p.category_id,
          }}
        />
      </div>
    </ProductCardShell>
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
          className="inline-flex items-center mt-5 h-11 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
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
