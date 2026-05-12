import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
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

  // Validate store access (RLS handles read; just confirm it exists for us)
  const { data: store } = await supabase
    .from("supermarkets")
    .select("name")
    .eq("id", id)
    .single();
  if (!store) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        Дэлгүүр олдсонгүй эсвэл хандах эрхгүй.
      </div>
    );
  }

  let pricesQuery = supabase
    .from("supermarket_prices")
    .select(
      "product_id, sku, name, brand, image_url, category_id, effective_price",
    )
    .eq("supermarket_id", id)
    .order("name");

  if (q && q.trim()) {
    const term = q.trim();
    pricesQuery = pricesQuery.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`,
    );
  }
  if (category) pricesQuery = pricesQuery.eq("category_id", category);

  const [{ data: products }, cats] = await Promise.all([
    pricesQuery,
    getCategories(),
  ]);

  const rows = (products as PriceRow[] | null) ?? [];

  function chipHref(opts: { category?: string }) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (opts.category) p.set("category", opts.category);
    const qs = p.toString();
    return qs ? `/rep/stores/${id}/catalog?${qs}` : `/rep/stores/${id}/catalog`;
  }

  return (
    <div>
      <RepHeader
        title={store.name}
        subtitle="Захиалга үүсгэж байна"
        backHref={`/rep/stores/${id}`}
        cartHref={`/rep/stores/${id}/cart`}
        cartScope={{ storeId: id }}
      />

      <main className="px-3 sm:px-4 py-4 max-w-3xl mx-auto">
        <div className="mb-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-xs">
          📋 <span className="font-medium">{store.name}</span>-н нэрийн өмнөөс захиалга
        </div>

        <form method="get" className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Хайх..."
              className="w-full rounded-full border border-input bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {category && (
            <input type="hidden" name="category" defaultValue={category} />
          )}
        </form>

        <div className="flex gap-2 overflow-x-auto pb-3 -mx-3 px-3 mb-4">
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
          <div className="grid grid-cols-2 gap-3">
            {rows.map((p) => (
              <Link
                key={p.product_id}
                href={`/rep/stores/${id}/catalog/${p.product_id}`}
                className="bg-background rounded-lg border overflow-hidden flex flex-col hover:shadow-sm transition-shadow"
              >
                <div className="aspect-square bg-muted relative">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 240px"
                      quality={90}
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                      Зураг алга
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  {p.brand && (
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {p.brand}
                    </div>
                  )}
                  <div className="text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                    {p.name}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">
                      {formatMnt(p.effective_price)}
                    </div>
                    <QuickAddButton
                      scope={{ storeId: id }}
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
            ))}
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
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}
