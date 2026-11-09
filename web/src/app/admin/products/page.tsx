import Link from "next/link";
import Image from "next/image";
import { ImageOff, Plus, Search, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getCategories, type CategoryRow } from "@/lib/categories";
import {
  ALL_PRODUCTS_VISUAL,
  CategoryIconTile,
  ProductPlaceholder,
  categoryVisual,
} from "@/lib/category-visual";
import { searchNormalize } from "@/lib/translit";
import { formatMnt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductCategorySelect } from "@/components/admin/product-category-select";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{
  q?: string;
  category?: string;
  status?: string;
  photo?: string;
}>;

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  internal_code: string | null;
  image_url: string | null;
  base_price: number;
  stock: number;
  active: boolean;
  category_id: string | null;
};

type Status = "all" | "visible" | "hidden";

type Filters = { q: string; category: string; status: Status; photo: boolean };

function buildHref(f: Partial<Filters>) {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.category) sp.set("category", f.category);
  if (f.status && f.status !== "all") sp.set("status", f.status);
  if (f.photo) sp.set("photo", "missing");
  const qs = sp.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

const nameCollator = new Intl.Collator("mn", { numeric: true, sensitivity: "base" });

/**
 * Products grouped by category — the same grouping stores see. Filter by
 * category, visibility or missing photo; move a product to another
 * category straight from its card.
 */
export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters: Filters = {
    q: sp.q?.trim() ?? "",
    category: sp.category ?? "",
    status: sp.status === "visible" || sp.status === "hidden" ? sp.status : "all",
    photo: sp.photo === "missing",
  };

  const supabase = await createClient();
  // Every product (a single request stops at 1,000 rows).
  const [loaded, categories] = await Promise.all([
    fetchAll<ProductRow>(() =>
      supabase
        .from("products")
        .select("id, sku, name, brand, internal_code, image_url, base_price, stock, active, category_id")
        .order("name")
        .order("id"),
    )
      .then((rows) => ({ rows, error: null as string | null }))
      .catch((e: Error) => ({ rows: [] as ProductRow[], error: e.message })),
    getCategories(),
  ]);
  const all = loaded.rows;
  const error = loaded.error ? { message: loaded.error } : null;
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  // Counts for the chips ignore the chip's own dimension.
  const matchesStatus = (p: ProductRow) =>
    filters.status === "all" || (filters.status === "visible" ? p.active : !p.active);
  const tokens = searchNormalize(filters.q).split(" ").filter(Boolean);
  const matchesQuery = (p: ProductRow) => {
    if (tokens.length === 0) return true;
    const hay = searchNormalize(`${p.name} ${p.brand ?? ""} ${p.sku} ${p.internal_code ?? ""}`);
    return tokens.every((t) => hay.includes(t));
  };
  const matchesPhoto = (p: ProductRow) => !filters.photo || !p.image_url;
  const matchesCategory = (p: ProductRow) =>
    !filters.category ||
    (filters.category === "none" ? !p.category_id || !catById.has(p.category_id) : p.category_id === filters.category);

  const base = all.filter((p) => matchesQuery(p) && matchesPhoto(p));
  const forCategoryChips = base.filter(matchesStatus);
  const forStatusChips = base.filter(matchesCategory);
  const rows = forCategoryChips.filter(matchesCategory);

  const statusCount = {
    all: forStatusChips.length,
    visible: forStatusChips.filter((p) => p.active).length,
    hidden: forStatusChips.filter((p) => !p.active).length,
  };
  const missingPhotos = all.filter((p) => p.active && !p.image_url).length;
  const countIn = (id: string) => forCategoryChips.filter((p) => p.category_id === id).length;
  const uncategorized = forCategoryChips.filter((p) => !p.category_id || !catById.has(p.category_id)).length;

  // Group into sections in the catalog's order.
  const sections: { cat: CategoryRow | null; items: ProductRow[] }[] = [];
  for (const c of categories) {
    const items = rows.filter((p) => p.category_id === c.id);
    if (items.length) sections.push({ cat: c, items });
  }
  const orphans = rows.filter((p) => !p.category_id || !catById.has(p.category_id));
  if (orphans.length) sections.push({ cat: null, items: orphans });
  for (const s of sections) {
    s.items.sort((a, b) => Number(b.active) - Number(a.active) || nameCollator.compare(a.name, b.name));
  }

  const filtered = Boolean(filters.q || filters.category || filters.status !== "all" || filters.photo);

  return (
    <div className="w-full">
      <div className="mb-5 flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Бараа</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {all.length} бараа · {all.filter((p) => p.active).length} нь дэлгүүрт харагдана
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/categories">
              <Settings2 className="size-4" />
              <span className="hidden sm:inline">Ангилал</span>
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Шинэ бараа</span>
              <span className="sm:hidden">Шинэ</span>
            </Link>
          </Button>
        </div>
      </div>

      <Card className="mb-5 gap-3 p-3 sm:p-4">
        <form className="relative" action="/admin/products">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Нэр, баркод, дотоод код, брэнд..."
            className="field pl-9"
          />
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          {filters.status !== "all" && <input type="hidden" name="status" value={filters.status} />}
          {filters.photo && <input type="hidden" name="photo" value="missing" />}
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "Бүгд"],
              ["visible", "Харагдана"],
              ["hidden", "Нуусан"],
            ] as const
          ).map(([key, label]) => (
            <Chip key={key} href={buildHref({ ...filters, status: key })} active={filters.status === key}>
              {label} <Count n={statusCount[key]} />
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <Chip href={buildHref({ ...filters, photo: !filters.photo })} active={filters.photo} tone="amber">
            <ImageOff className="h-3.5 w-3.5" />
            Зураггүй <Count n={missingPhotos} />
          </Chip>
        </div>

        {/* Wraps instead of scrolling sideways: every category in view. */}
        <div className="flex flex-wrap gap-1.5">
          <Chip href={buildHref({ ...filters, category: "" })} active={!filters.category}>
            <CategoryIconTile visual={ALL_PRODUCTS_VISUAL} size="xs" active={!filters.category} />
            Бүх ангилал <Count n={forCategoryChips.length} />
          </Chip>
          {categories.map((c) => {
            const n = countIn(c.id);
            if (n === 0 && filters.category !== c.id) return null;
            const active = filters.category === c.id;
            return (
              <Chip key={c.id} href={buildHref({ ...filters, category: c.id })} active={active}>
                <CategoryIconTile visual={categoryVisual(c)} size="xs" active={active} />
                {c.name} <Count n={n} />
              </Chip>
            );
          })}
          {(uncategorized > 0 || filters.category === "none") && (
            <Chip href={buildHref({ ...filters, category: "none" })} active={filters.category === "none"} tone="amber">
              Ангилалгүй <Count n={uncategorized} />
            </Chip>
          )}
        </div>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="mb-1">Бараа олдсонгүй.</p>
          {filtered && (
            <Link href="/admin/products" className="text-sm font-semibold text-primary underline underline-offset-2">
              Шүүлтүүр арилгах
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-7">
          {sections.map(({ cat, items }) => {
            const visual = cat ? categoryVisual(cat) : categoryVisual(null);
            return (
              <section key={cat?.id ?? "none"}>
                <div className="mb-3 flex items-center gap-2.5">
                  <CategoryIconTile visual={visual} size="md" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-[16px] font-semibold leading-tight">{cat?.name ?? "Ангилалгүй"}</h2>
                    <p className="text-[12px] text-muted-foreground">
                      {items.length} бараа · {items.filter((p) => p.active).length} харагдана
                    </p>
                  </div>
                </div>
                <div className="@container">
                  <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                    {items.map((p) => (
                      <AdminProductCard
                        key={`${p.id}:${p.category_id ?? ""}`}
                        p={p}
                        category={cat}
                        categories={catOptions}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminProductCard({
  p,
  category,
  categories,
}: {
  p: ProductRow;
  category: CategoryRow | null;
  categories: { id: string; name: string }[];
}) {
  const visual = categoryVisual(category);
  const out = p.stock <= 0;
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-shadow hover:shadow-md",
        !p.active && "opacity-75",
      )}
    >
      <Link href={`/admin/products/${p.id}`} className="flex flex-1 flex-col">
        <div className={cn("relative aspect-[4/3] overflow-hidden", p.image_url ? "bg-muted" : visual.tone.wash)}>
          {p.image_url ? (
            <Image src={p.image_url} alt={p.name} fill sizes="240px" quality={85} className="object-cover" />
          ) : (
            <ProductPlaceholder visual={visual} />
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {!p.active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
                Нуусан
              </span>
            )}
            {out && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">Дууссан</span>
            )}
          </div>
          {!p.image_url && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-800">
              <ImageOff className="h-3 w-3" /> Зураггүй
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-3">
          {p.brand && (
            <div className="line-clamp-1 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">{p.brand}</div>
          )}
          <div className="mt-0.5 line-clamp-2 min-h-[2.4em] text-[12.5px] font-semibold leading-snug">{p.name}</div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <span className="text-[14px] font-bold tabular-nums">{formatMnt(p.base_price)}</span>
            <span
              className={cn(
                "text-[10.5px] font-semibold tabular-nums",
                out ? "text-rose-600" : "text-muted-foreground",
              )}
            >
              Үлд: {p.stock}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
            {[p.internal_code, p.sku].filter(Boolean).join(" · ")}
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <ProductCategorySelect productId={p.id} productName={p.name} value={p.category_id} categories={categories} />
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  tone,
  children,
}: {
  href: string;
  active: boolean;
  tone?: "amber";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pl-1.5 pr-3 text-[12.5px] font-semibold transition-colors",
        active
          ? tone === "amber"
            ? "bg-amber-500 text-white"
            : "bg-primary text-primary-foreground"
          : "bg-muted/70 text-foreground/80 ring-1 ring-border hover:bg-muted",
        !active && tone === "amber" && "text-amber-800 dark:text-amber-300",
      )}
    >
      {children}
    </Link>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tabular-nums opacity-70">{n}</span>;
}
