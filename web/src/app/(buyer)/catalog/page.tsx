import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { QuickAddButton } from "@/components/buyer/quick-add-button";
import { formatMnt } from "@/lib/format";

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

type Category = {
  id: string;
  name: string;
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, category } = await searchParams;
  const session = await requireSession();
  const supermarketId = session.profile.supermarket_id!;

  const supabase = await createClient();

  let query = supabase
    .from("supermarket_prices")
    .select(
      "product_id, sku, name, brand, image_url, category_id, effective_price",
    )
    .eq("supermarket_id", supermarketId)
    .order("name");

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`,
    );
  }
  if (category) query = query.eq("category_id", category);

  const [{ data: products }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  const rows = (products as PriceRow[] | null) ?? [];
  const cats = (categories as Category[] | null) ?? [];

  return (
    <div className="px-3 sm:px-4 py-4 max-w-3xl mx-auto">
      <form method="get" className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Хайх (барааны нэр, SKU)..."
            className="w-full rounded-full border border-input bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {category && (
          <input type="hidden" name="category" defaultValue={category} />
        )}
      </form>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-3 px-3 sm:-mx-4 sm:px-4 mb-4 scrollbar-thin">
        <Chip href={chipHref({ q })} active={!category}>
          Бүгд
        </Chip>
        {cats.map((c) => (
          <Chip
            key={c.id}
            href={chipHref({ q, category: c.id })}
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
              href={`/catalog/${p.product_id}`}
              className="bg-background rounded-lg border overflow-hidden flex flex-col hover:shadow-sm transition-shadow"
            >
              <div className="aspect-square bg-muted relative">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 200px"
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
    </div>
  );
}

function chipHref({ q, category }: { q?: string; category?: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
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

// Long category names are unfriendly in chips. Use the first 1-2 keywords.
function shortLabel(name: string): string {
  // Split on comma first
  const commaIdx = name.indexOf(",");
  const head = commaIdx > -1 ? name.slice(0, commaIdx) : name;
  // If still long, take first two words
  const words = head.split(/\s+/);
  return words.slice(0, 2).join(" ");
}
