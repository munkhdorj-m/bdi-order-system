import Link from "next/link";
import Image from "next/image";
import { ClipboardList, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import { QuickAddButton } from "@/components/buyer/quick-add-button";
import { RepHeader } from "@/components/rep/rep-header";
import { formatMnt } from "@/lib/format";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ q?: string; category?: string }>;

type PriceRow = {
  product_id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  category_id: string | null;
  effective_price: number;
  /** Same product's catalog list price (without per-store override). Compared
   *  against effective_price to flag the "Тусгай үнэ" badge. */
  list_price: number;
  box_count: number | null;
};

type StoreContext = {
  name: string;
  district: string | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

function shortLabel(name: string): string {
  const commaIdx = name.indexOf(",");
  const head = commaIdx > -1 ? name.slice(0, commaIdx) : name;
  return head.split(/\s+/).slice(0, 2).join(" ");
}

export default async function RepCatalogPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { q, category } = await searchParams;
  const supabase = await createClient();

  // Pull store + the rep's "managed by" so the context banner can name the
  // buyer the rep is ordering on behalf of.
  const { data: storeRaw } = await supabase
    .from("supermarkets")
    .select(
      "name, district, profiles:assigned_rep_id(full_name, phone)",
    )
    .eq("id", id)
    .single();

  if (!storeRaw) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        Дэлгүүр олдсонгүй эсвэл хандах эрхгүй.
      </div>
    );
  }
  const store = storeRaw as unknown as StoreContext;

  // Searching → the shared search_products RPC (fix 31): multi-word,
  // typo-tolerant, ranked. Browsing → the plain view query ordered by
  // name. The view exposes base_price directly now, so the "Тусгай үнэ"
  // badge compares effective_price vs base_price with no extra join.
  const term = (q ?? "").trim();
  const searching = term.length > 0;

  const productsQuery = searching
    ? supabase.rpc("search_products", {
        p_supermarket_id: id,
        p_query: term,
        p_category: category ?? null,
      })
    : (() => {
        let pq = supabase
          .from("supermarket_prices")
          .select(
            "product_id, sku, name, brand, image_url, category_id, effective_price, box_count, base_price",
          )
          .eq("supermarket_id", id)
          .order("name");
        if (category) pq = pq.eq("category_id", category);
        return pq;
      })();

  const [{ data: rawProducts }, cats] = await Promise.all([
    productsQuery,
    getCategories(),
  ]);

  const rows: PriceRow[] = (
    (rawProducts as unknown as Array<
      Omit<PriceRow, "list_price"> & { base_price: number | null }
    >) ?? []
  ).map((p) => ({
    product_id: p.product_id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    image_url: p.image_url,
    category_id: p.category_id,
    effective_price: p.effective_price,
    box_count: p.box_count,
    list_price: p.base_price ?? p.effective_price,
  }));

  function chipHref(opts: { category?: string }) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (opts.category) p.set("category", opts.category);
    const qs = p.toString();
    return qs ? `/rep/stores/${id}/catalog?${qs}` : `/rep/stores/${id}/catalog`;
  }

  const onBehalfOf =
    store.profiles?.full_name ?? store.profiles?.phone ?? "Худалдан авагч";

  return (
    <div>
      <RepHeader
        title="Каталог"
        subtitle={`${store.name} · нэрийн өмнөөс`}
        backHref={`/rep/stores/${id}`}
        cartHref={`/rep/stores/${id}/cart`}
        cartScope={{ storeId: id }}
      />

      <main className="px-3 sm:px-4 py-3 max-w-3xl mx-auto pb-6">
        {/* Persistent amber context banner — the R3 critical UX */}
        <div className="rounded-2xl ring-2 ring-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/30 dark:ring-amber-700/60 p-3 flex items-center gap-3 shadow-sm">
          <div className="size-10 rounded-xl bg-white ring-1 ring-amber-300/60 dark:bg-amber-950/60 dark:ring-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
            <ClipboardList className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[9.5px] uppercase tracking-[0.12em] font-bold text-amber-900/80 dark:text-amber-300/80">
              Нэрийн өмнөөс захиалж байна
            </div>
            <div className="text-[13.5px] font-bold text-amber-950 dark:text-amber-100 truncate">
              {store.name} · {onBehalfOf}
            </div>
            <div className="text-[10.5px] text-amber-900/80 dark:text-amber-300/80">
              Үнэ нь тус дэлгүүрийн override-ийн дагуу харуулагдаж байна
            </div>
          </div>
          <Link
            href="/rep"
            className="text-[11.5px] font-bold text-amber-900 dark:text-amber-200 underline shrink-0"
          >
            Солих
          </Link>
        </div>

        {/* Search */}
        <form method="get" className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Хайх..."
              className="w-full h-10 rounded-xl bg-muted/60 border border-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground/80 focus:outline-none focus:bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>
          {category && (
            <input type="hidden" name="category" defaultValue={category} />
          )}
        </form>

        {/* Category chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-thin">
          <Chip href={chipHref({})} active={!category}>
            Бүгд
          </Chip>
          {cats.map((c) => (
            <Chip
              key={c.id}
              href={chipHref({ category: c.id })}
              active={category === c.id}
            >
              {shortLabel(c.name)}
            </Chip>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Бараа олдсонгүй.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {rows.map((p) => {
              const hasOverride = p.effective_price !== p.list_price;
              return (
                <Link
                  key={p.product_id}
                  href={`/rep/stores/${id}/catalog/${p.product_id}`}
                  className="flex flex-col rounded-2xl overflow-hidden ring-1 ring-border bg-card hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-gradient-to-br from-muted/30 to-muted/60 relative overflow-hidden">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 240px"
                        quality={85}
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                        —
                      </div>
                    )}
                    {hasOverride && (
                      <div className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-white text-primary px-1.5 py-0.5 rounded-full ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] dark:bg-card">
                        Тусгай үнэ
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5 flex-1">
                    {p.brand && (
                      <div className="text-[9px] uppercase tracking-[0.08em] font-bold text-primary truncate">
                        {p.brand}
                      </div>
                    )}
                    <div className="text-[11.5px] font-semibold leading-tight line-clamp-2 h-[2.2em]">
                      {p.name}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-[13px] font-bold tabular-nums">
                        {formatMnt(p.effective_price)}
                      </span>
                      {hasOverride && (
                        <span className="text-[10px] text-muted-foreground line-through tabular-nums">
                          {formatMnt(p.list_price)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 self-end">
                      <QuickAddButton
                        scope={{ storeId: id }}
                        boxCount={p.box_count}
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
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center whitespace-nowrap shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold leading-none transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
          : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-muted/80 dark:hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
