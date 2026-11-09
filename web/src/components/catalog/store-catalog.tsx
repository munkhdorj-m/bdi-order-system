import Link from "next/link";
import Image from "next/image";
import Form from "next/form";
import { RotateCcw, Search, SearchX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories, type CategoryRow } from "@/lib/categories";
import {
  CategoryIconTile,
  ProductPlaceholder,
  USUAL_PRODUCTS_VISUAL,
  categoryVisual,
} from "@/lib/category-visual";
import { formatMnt } from "@/lib/format";
import {
  priceWithProductDiscount,
  rulesForPriceList,
  type DiscountRule,
} from "@/lib/discount";
import type { CartScope } from "@/lib/cart";
import { CatalogNav, type CatalogNavItem } from "./catalog-nav";
import { CartBar } from "./cart-bar";
import { sectionDomId } from "./section-id";
import { ProductCardShell } from "./cart-controls";

/**
 * The store-facing catalog, shared by the store's own app (/catalog), a
 * rep ordering at a store (/rep/stores/[id]/catalog) and the admin's
 * "as the store sees it" preview. One page, grouped by category in the
 * order set on /admin/categories:
 *
 *   - "Өмнө авсан" first: what this store has ordered before, so a repeat
 *     order is a few taps;
 *   - then every category as its own section with its picture;
 *   - the category rail / sidebar jumps between sections without a reload.
 *
 * Searching switches to a flat, best-match-first list.
 */

export type CatalogMode = "buyer" | "rep" | "preview";

type CatalogProduct = {
  product_id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  category_id: string | null;
  effective_price: number;
  base_price: number | null;
  unit: string | null;
  box_count: number | null;
  stock: number;
};

type Section = {
  id: string;
  name: string;
  icon: string | null;
  usual?: boolean;
  items: CatalogProduct[];
};

const PRODUCT_COLUMNS =
  "product_id, sku, name, brand, image_url, category_id, effective_price, base_price, unit, box_count, stock";

const nameCollator = new Intl.Collator("mn", { numeric: true, sensitivity: "base" });

/** In-stock first, then by name with numbers in numeric order (4ш < 10ш). */
function byStockThenName(a: CatalogProduct, b: CatalogProduct): number {
  const ao = a.stock <= 0 ? 1 : 0;
  const bo = b.stock <= 0 ? 1 : 0;
  return ao - bo || nameCollator.compare(a.name, b.name);
}

const OTHER_SECTION = { id: "other", name: "Бусад", icon: "other" } as const;

export async function StoreCatalog({
  storeId,
  mode,
  q,
  initialCategory,
  basePath,
  productHref,
  cartScope,
  cartHref,
  stickyTopClass,
}: {
  storeId: string;
  mode: CatalogMode;
  q?: string;
  /** Category to scroll to on load (deal links use `?category=`). */
  initialCategory?: string;
  /** This page's path; the search box submits here. */
  basePath: string;
  productHref: (productId: string) => string;
  cartScope?: CartScope;
  /** Where the floating cart bar leads; no bar without it (admin preview). */
  cartHref?: string;
  stickyTopClass?: string;
}) {
  // Room at the bottom so the floating cart bar never covers the last row.
  const bottomPad = cartHref ? "pb-28" : "pb-6";
  const supabase = await createClient();
  const term = (q ?? "").trim();
  const searching = term.length > 0;

  const [productsRes, cats, rules, usualIds] = await Promise.all([
    searching
      ? supabase.rpc("search_products", {
          p_supermarket_id: storeId,
          p_query: term,
          p_category: null,
        })
      : supabase.from("supermarket_prices").select(PRODUCT_COLUMNS).eq("supermarket_id", storeId),
    getCategories(),
    mode === "buyer" ? loadSaleRules(storeId) : Promise.resolve([] as DiscountRule[]),
    searching ? Promise.resolve([] as string[]) : loadUsualProductIds(storeId),
  ]);

  const rows = ((productsRes.data as unknown as CatalogProduct[] | null) ?? []).map((p) => ({
    ...p,
    effective_price: Number(p.effective_price) || 0,
    base_price: p.base_price == null ? null : Number(p.base_price),
    stock: Number(p.stock) || 0,
  }));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const cartBar = cartHref ? (
    <CartBar href={cartHref} scope={cartScope} aboveTabBar={mode === "buyer"} rules={rules} />
  ) : null;

  const ctx: CardContext = {
    mode,
    rules,
    cartScope,
    productHref,
    catById,
  };

  const searchForm = (variant: "mobile" | "desktop") => (
    <SearchForm basePath={basePath} q={term} variant={variant} />
  );

  if (productsRes.error) {
    // The raw database message means nothing to a shop; log it, offer a retry.
    console.error("[store-catalog] products failed:", productsRes.error.message);
    return (
      <div className="px-4 py-16 flex flex-col items-center text-center">
        <p className="text-[15px] font-semibold">Бараа ачаалж чадсангүй</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Интернэт холболтоо шалгаад дахин оролдоно уу.</p>
        <Link
          href={term ? `${basePath}?q=${encodeURIComponent(term)}` : basePath}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground"
        >
          <RotateCcw className="h-4 w-4" />
          Дахин оролдох
        </Link>
      </div>
    );
  }

  /* ---------------- Search results: flat, ranked. ---------------- */
  if (searching) {
    return (
      <div className={`px-3 sm:px-4 lg:px-6 xl:px-8 pt-3 ${bottomPad} lg:flex lg:gap-6`}>
        <div className="lg:hidden mb-3">{searchForm("mobile")}</div>
        <aside className="hidden lg:block lg:w-64 shrink-0">
          <div className="sticky top-[calc(3.5rem+1rem)]">{searchForm("desktop")}</div>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[13px] min-w-0 truncate">
              <span className="font-bold tabular-nums">{rows.length}</span>
              <span className="text-muted-foreground"> илэрц · “{term}”</span>
            </p>
            <Link
              href={basePath}
              className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-card ring-1 ring-border text-[13px] font-semibold hover:bg-accent/60 transition-colors"
            >
              <X className="h-4 w-4" /> Бүх бараа
            </Link>
          </div>
          {rows.length === 0 ? (
            <EmptyResults term={term} basePath={basePath} />
          ) : (
            <ProductGrid>
              {rows.map((p, i) => (
                <ProductCard key={p.product_id} p={p} index={i} priority={i < 4} ctx={ctx} showCategory />
              ))}
            </ProductGrid>
          )}
        </div>
        {cartBar}
      </div>
    );
  }

  /* ---------------- Browsing: sections by category. ---------------- */
  const groups = new Map<string, CatalogProduct[]>();
  for (const p of rows) {
    const key = p.category_id && catById.has(p.category_id) ? p.category_id : OTHER_SECTION.id;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }

  const byId = new Map(rows.map((p) => [p.product_id, p]));
  const usual = usualIds.map((id) => byId.get(id)).filter((p): p is CatalogProduct => Boolean(p));

  const sections: Section[] = [
    ...(usual.length > 0
      ? [{ id: "usual", name: "Өмнө авсан", icon: null, usual: true, items: usual }]
      : []),
    ...cats
      .filter((c) => groups.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon, items: groups.get(c.id)!.sort(byStockThenName) })),
    ...(groups.has(OTHER_SECTION.id)
      ? [{ ...OTHER_SECTION, items: groups.get(OTHER_SECTION.id)!.sort(byStockThenName) }]
      : []),
  ];

  const navItems: CatalogNavItem[] = sections.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    count: s.items.length,
    usual: s.usual,
  }));

  let cardIndex = 0;

  return (
    <div className={`px-3 sm:px-4 lg:px-6 xl:px-8 pt-3 ${bottomPad}`}>
      {cartBar}
      <div className="lg:hidden mb-1">{searchForm("mobile")}</div>
      <div className="lg:flex lg:gap-6">
        <CatalogNav
          items={navItems}
          initialId={initialCategory && groups.has(initialCategory) ? initialCategory : undefined}
          searchSlot={searchForm("desktop")}
          stickyTopClass={stickyTopClass}
        />
        <div className="flex-1 min-w-0 space-y-7">
          {sections.length === 0 && (
            <div className="py-20 text-center text-sm text-muted-foreground">Бараа алга байна.</div>
          )}
          {sections.map((s) => {
            const visual = s.usual ? USUAL_PRODUCTS_VISUAL : categoryVisual(s);
            return (
              <section
                key={s.id}
                id={sectionDomId(s.id)}
                aria-labelledby={`${sectionDomId(s.id)}-title`}
                className="scroll-mt-[9.5rem] lg:scroll-mt-20"
              >
                <header className="flex items-center gap-2.5 mb-3">
                  <CategoryIconTile visual={visual} size="md" />
                  <div className="min-w-0">
                    <h2 id={`${sectionDomId(s.id)}-title`} className="font-display text-[16px] font-semibold leading-tight truncate">
                      {s.name}
                    </h2>
                    <p className="text-[12px] text-muted-foreground leading-tight">
                      {s.usual ? "Таны өмнө захиалсан бараа" : `${s.items.length} бараа`}
                    </p>
                  </div>
                </header>
                <ProductGrid>
                  {s.items.map((p) => {
                    const i = cardIndex++;
                    return (
                      <ProductCard
                        key={`${s.id}:${p.product_id}`}
                        p={p}
                        index={i}
                        priority={i < 4}
                        ctx={ctx}
                        showCategory={s.usual}
                      />
                    );
                  })}
                </ProductGrid>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

async function loadSaleRules(storeId: string): Promise<DiscountRule[]> {
  const supabase = await createClient();
  const [{ data: discountRows }, { data: storeRow }] = await Promise.all([
    supabase
      .from("discounts")
      .select(
        "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, ends_at, target_mode, target_price_list_ids",
      )
      .eq("kind", "product"),
    supabase.from("supermarkets").select("price_list_id").eq("id", storeId).single(),
  ]);
  return rulesForPriceList(
    (discountRows as unknown as DiscountRule[] | null) ?? [],
    (storeRow?.price_list_id as string | null) ?? null,
  );
}

/**
 * Products this store ordered before, most often first (ties: most recent).
 * RLS limits it to the store's own orders (buyer), the rep's stores, or
 * any store for an admin.
 */
async function loadUsualProductIds(storeId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("created_at, order_items(product_id, unit_price)")
    .eq("supermarket_id", storeId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(30);
  const stats = new Map<string, { n: number; rank: number }>();
  (data ?? []).forEach((o, rank) => {
    const items =
      (o as { order_items: { product_id: string | null; unit_price: number | null }[] | null })
        .order_items ?? [];
    const seen = new Set<string>();
    for (const it of items) {
      // 0₮ lines are deal gifts — received, not bought.
      if (!(Number(it.unit_price) > 0)) continue;
      if (!it.product_id || seen.has(it.product_id)) continue;
      seen.add(it.product_id);
      const s = stats.get(it.product_id);
      if (s) s.n++;
      else stats.set(it.product_id, { n: 1, rank });
    }
  });
  return [...stats.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].rank - b[1].rank)
    .slice(0, 12)
    .map(([id]) => id);
}

/* ------------------------------------------------------------------ */

type CardContext = {
  mode: CatalogMode;
  rules: DiscountRule[];
  cartScope?: CartScope;
  productHref: (productId: string) => string;
  catById: Map<string, CategoryRow>;
};

/**
 * Columns follow the space the grid actually has (container queries), not
 * the screen: the same catalog sits full-width in the store app and next to
 * the sidebar in admin.
 */
function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6 gap-2.5 @lg:gap-3">
        {children}
      </div>
    </div>
  );
}

function ProductCard({
  p,
  index,
  priority,
  ctx,
  showCategory = false,
}: {
  p: CatalogProduct;
  index: number;
  priority: boolean;
  ctx: CardContext;
  showCategory?: boolean;
}) {
  const category = p.category_id ? (ctx.catById.get(p.category_id) ?? null) : null;
  const visual = categoryVisual(category);
  const sale =
    ctx.mode === "buyer"
      ? priceWithProductDiscount(p.product_id, p.category_id, p.effective_price, ctx.rules)
      : null;
  const outOfStock = p.stock <= 0;
  const specialPrice =
    ctx.mode !== "buyer" && p.base_price != null && p.effective_price !== p.base_price;
  const unit = p.unit?.trim() || "ш";

  return (
    <ProductCardShell
      product={{
        product_id: p.product_id,
        name: p.name,
        brand: p.brand,
        image_url: p.image_url,
        // The list price, not the sale price: the cart re-applies
        // discounts itself and itemises them.
        unit_price: p.effective_price,
        category_id: p.category_id,
        category_icon: visual.key,
      }}
      boxCount={p.box_count}
      scope={ctx.cartScope}
      // Stores can't order what's out of stock; a rep can (stock on the
      // website isn't kept exact yet), so they only see the label.
      disabled={outOfStock && ctx.mode !== "rep"}
      style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
    >
      <Link
        href={ctx.productHref(p.product_id)}
        className="flex flex-col flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl"
      >
        <div className={`aspect-[4/3.4] relative overflow-hidden ${p.image_url ? "bg-muted/40" : visual.tone.wash}`}>
          {p.image_url ? (
            <Image
              src={p.image_url}
              alt={p.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 200px"
              // Resized thumbnails (WebP, q85): a ~170px card shouldn't pull
              // the full upload over mobile data. The product page keeps
              // the full-quality original.
              quality={85}
              preload={priority}
              loading={priority ? "eager" : "lazy"}
              className={`object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.04] ${outOfStock ? "grayscale opacity-60" : ""}`}
            />
          ) : (
            <ProductPlaceholder visual={visual} dim={outOfStock} />
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {sale && (
              <span className="px-1.5 py-0.5 rounded-md text-[12px] font-bold bg-emerald-600 text-white shadow-sm">
                −{sale.pct}%
              </span>
            )}
            {specialPrice && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-primary ring-1 ring-primary/25 dark:bg-card">
                Тусгай үнэ
              </span>
            )}
          </div>
          {outOfStock && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center">
              <span className="px-2.5 py-1 rounded-full bg-foreground/80 text-background text-[12px] font-bold backdrop-blur-sm">
                Дууссан
              </span>
            </div>
          )}
        </div>

        <div className="px-3 pt-2.5 pb-2 flex flex-col flex-1 gap-1">
          {showCategory && category && (
            <div className={`flex items-center gap-1 text-[11.5px] font-semibold ${visual.tone.text}`}>
              <CategoryIconTile visual={visual} size="xs" />
              <span className="truncate">{category.name}</span>
            </div>
          )}
          {p.brand && (
            <div className="text-[11px] uppercase tracking-[0.08em] font-bold text-primary line-clamp-1">
              {p.brand}
            </div>
          )}
          <div className="text-[13.5px] font-semibold leading-snug line-clamp-2 min-h-[2.4rem]">{p.name}</div>
          <div className="mt-auto flex items-baseline gap-1 flex-wrap">
            {sale ? (
              <>
                <span className="font-display text-[16px] font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                  {formatMnt(sale.net)}
                </span>
                <span className="text-[12px] tabular-nums line-through text-muted-foreground/70">
                  {formatMnt(p.effective_price)}
                </span>
              </>
            ) : (
              <span className="font-display text-[16px] font-bold tabular-nums tracking-tight">{formatMnt(p.effective_price)}</span>
            )}
            <span className="text-[12px] text-muted-foreground">/{unit}</span>
          </div>
        </div>
      </Link>
    </ProductCardShell>
  );
}

function SearchForm({
  basePath,
  q,
  variant,
}: {
  basePath: string;
  q: string;
  variant: "mobile" | "desktop";
}) {
  const mobile = variant === "mobile";
  // next/form: the search opens in-app (no full page reload over mobile
  // data) and the results' loading skeleton is prefetched.
  return (
    <Form action={basePath} className="relative" role="search">
      <Search
        className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none ${mobile ? "left-4 h-[18px] w-[18px]" : "left-3 h-4 w-4"}`}
      />
      <input
        key={q}
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Бараа хайх: нэр, брэнд, баркод..."
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Бараа хайх"
        className={
          mobile
            ? "w-full h-11 rounded-2xl bg-card ring-1 ring-border shadow-sm pl-11 pr-4 text-[15px] placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
            : "w-full h-10 rounded-xl bg-muted/60 border border-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground/80 focus:outline-none focus:bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        }
      />
    </Form>
  );
}

function EmptyResults({ term, basePath }: { term: string; basePath: string }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4 ring-1 ring-border">
        <SearchX className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
      </div>
      <p className="text-base font-semibold">“{term}” олдсонгүй</p>
      <p className="text-[13px] text-muted-foreground mt-1.5 max-w-xs">
        Өөр үгээр хайж үзнэ үү, эсвэл ангиллаар нь харна уу.
      </p>
      <Link
        href={basePath}
        className="inline-flex items-center mt-5 h-11 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all"
      >
        Бүх бараа харах
      </Link>
    </div>
  );
}

/** Streaming placeholder in the same shape as the real page. */
export function StoreCatalogSkeleton() {
  return (
    <div className="px-3 sm:px-4 lg:px-6 xl:px-8 pt-3 pb-6" aria-busy="true" aria-label="Ачаалж байна">
      <div className="lg:hidden h-11 rounded-2xl bg-muted/70 mb-3" />
      <div className="lg:hidden flex gap-1 overflow-hidden mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[74px] flex flex-col items-center gap-1.5 py-1">
            <div className="size-10 rounded-xl bg-muted/70" />
            <div className="h-2 w-12 rounded-full bg-muted/70" />
          </div>
        ))}
      </div>
      <div className="lg:flex lg:gap-6">
        <div className="hidden lg:flex lg:w-64 shrink-0 flex-col gap-2">
          <div className="h-10 rounded-xl bg-muted/70 mb-2" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-muted/50" />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="size-10 rounded-xl bg-muted/70" />
            <div className="h-4 w-40 rounded bg-muted/70" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl ring-1 ring-border bg-card overflow-hidden">
                <div className="aspect-[4/3.4] bg-muted/60 relative overflow-hidden">
                  <div className="shimmer absolute inset-0" />
                </div>
                <div className="p-3 space-y-2">
                  <div className="h-3 w-full rounded bg-muted/70" />
                  <div className="h-3 w-2/3 rounded bg-muted/70" />
                  <div className="h-4 w-20 rounded bg-muted/70" />
                  <div className="h-10 w-full rounded-xl bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
