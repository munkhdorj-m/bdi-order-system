import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartForm } from "@/components/buyer/add-to-cart-form";
import { RepHeader } from "@/components/rep/rep-header";
import { formatMnt } from "@/lib/format";
import { getCategories } from "@/lib/categories";
import { CategoryIconTile, categoryVisual } from "@/lib/category-visual";

type Params = Promise<{ id: string; productId: string }>;

type PriceRow = {
  product_id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  category_id: string | null;
  effective_price: number;
  unit: string | null;
  box_count: number | null;
  stock: number | null;
  description: string | null;
};

export default async function RepProductDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id, productId } = await params;
  const supabase = await createClient();

  const [{ data: store }, { data: priced }, categories] =
    await Promise.all([
      supabase.from("supermarkets").select("name").eq("id", id).maybeSingle(),
      // The view carries the description too — no second products query.
      supabase
        .from("supermarket_prices")
        .select(
          "product_id, sku, name, brand, image_url, category_id, effective_price, unit, box_count, stock, description",
        )
        .eq("supermarket_id", id)
        .eq("product_id", productId)
        .maybeSingle(),
      getCategories(),
    ]);

  if (!store || !priced) notFound();
  const p = priced as PriceRow;
  const outOfStock = (Number(p.stock) || 0) <= 0;
  const category = categories.find((c) => c.id === p.category_id) ?? null;
  const visual = categoryVisual(category);

  return (
    <div>
      <RepHeader
        title={p.name}
        subtitle={store.name}
        backHref={`/rep/stores/${id}/catalog`}
        cartHref={`/rep/stores/${id}/cart`}
        cartScope={{ storeId: id }}
      />

      <main className="max-w-2xl mx-auto pb-12">
        <div className="aspect-square bg-muted relative">
          {p.image_url ? (
            <Image
              src={p.image_url}
              alt={p.name}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              quality={95}
              className="object-cover"
              preload
            />
          ) : (
            <div className={`absolute inset-0 flex items-center justify-center ${visual.tone.wash}`}>
              <div className={`size-28 rounded-3xl flex items-center justify-center ${visual.tone.tile}`}>
                <visual.Icon className="h-14 w-14" strokeWidth={1.5} />
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-5 space-y-4">
          <div>
            {category && (
              <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[12.5px] font-semibold ring-1 ring-border ${visual.tone.text}`}>
                <CategoryIconTile visual={visual} size="xs" />
                {category.name}
              </div>
            )}
            {p.brand && (
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {p.brand}
              </div>
            )}
            <h1 className="font-sans text-xl font-semibold leading-tight">{p.name}</h1>
            <div className="mt-1 text-xs text-muted-foreground font-mono">
              SKU: {p.sku}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-semibold">
              {formatMnt(p.effective_price)}
            </div>
            {p.unit && (
              <div className="text-sm text-muted-foreground">/ {p.unit}</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {/* A rep may still order it (website stock isn't exact yet),
                but should know before promising the shop. */}
            {outOfStock && (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[13px] font-bold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                Үлдэгдэлгүй
              </span>
            )}
            {p.box_count ? <span>Хайрцагт {p.box_count} ширхэг</span> : null}
          </div>

          <AddToCartForm
            scope={{ storeId: id }}
            cartHref={`/rep/stores/${id}/cart`}
            product={{
              product_id: p.product_id,
              name: p.name,
              brand: p.brand,
              image_url: p.image_url,
              unit_price: p.effective_price,
              category_id: p.category_id,
              category_icon: visual.key,
            }}
            boxCount={p.box_count}
          />

          {p.description && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium mb-2">Тайлбар</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {p.description}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
