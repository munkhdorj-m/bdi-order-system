import Image from "next/image";
import { notFound } from "next/navigation";
import { Box, Package, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { AddToCartForm } from "@/components/buyer/add-to-cart-form";
import { formatMnt } from "@/lib/format";
import {
  priceWithProductDiscount,
  rulesForPriceList,
  type DiscountRule,
} from "@/lib/discount";

type Params = Promise<{ id: string }>;

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
  stock: number;
  description: string | null;
};

/**
 * Buyer product-detail page laid out per the Hi-Fi "Confident" design:
 *   - rounded-3xl hero card with brand-tinted radial wash behind the image
 *   - tight title block: brand caps, 20px h1, 26px tabular price, optional
 *     box-count chip
 *   - description as a flat paragraph (no card wrapper)
 *   - sticky add-to-cart bar at the bottom of the viewport, sitting above
 *     the buyer bottom-tab-bar (which is h-14 + safe-area)
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const session = await requireSession();
  const supermarketId = session.profile.supermarket_id!;
  const supabase = await createClient();

  const [
    { data: priced },
    { data: extras },
    { data: discountRows },
    { data: storeRow },
  ] = await Promise.all([
    supabase
      .from("supermarket_prices")
      .select(
        "product_id, sku, name, brand, image_url, category_id, effective_price, unit, pack_size, box_count, stock",
      )
      .eq("supermarket_id", supermarketId)
      .eq("product_id", id)
      .single(),
    supabase.from("products").select("description").eq("id", id).single(),
    // RLS scopes to active in-window product discounts. We only need
    // product-kind rules here to compute the per-product sale price.
    supabase
      .from("discounts")
      .select(
        "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, ends_at, target_mode, target_price_list_ids",
      )
      .eq("kind", "product"),
    // Store targeting (fix 30) needs this store's price list.
    supabase
      .from("supermarkets")
      .select("price_list_id")
      .eq("id", supermarketId)
      .single(),
  ]);

  if (!priced) notFound();
  const p = {
    ...(priced as PriceRow),
    description: extras?.description ?? null,
  };

  const rules = rulesForPriceList(
    (discountRows as unknown as DiscountRule[] | null) ?? [],
    (storeRow?.price_list_id as string | null) ?? null,
  );
  const sale = priceWithProductDiscount(
    p.product_id,
    p.category_id,
    p.effective_price,
    rules,
  );
  const buyPrice = sale ? sale.net : p.effective_price;
  const outOfStock = p.stock <= 0;
  const lowStock = !outOfStock && p.stock < 10;

  return (
    <div className="relative">
      {/* Scroll content — bottom padding clears the sticky add-to-cart bar
          (~h-12 + paddings) AND the buyer bottom tab bar (h-14 + safe area
          which the shell already adds via pb-20). */}
      <div className="max-w-2xl mx-auto pb-44 lg:pb-32">
        {/* Hero image card */}
        <div className="px-3 pt-3">
          <div className="aspect-[5/4] rounded-3xl overflow-hidden relative ring-1 ring-border bg-gradient-to-b from-muted/20 via-muted/5 to-muted/40">
            {/* Brand-tinted radial wash behind the product image. Hue 263
                matches --primary so the glow reads as "BDI". */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.16_263/0.08),transparent_70%)]" />
            {p.image_url ? (
              <Image
                src={p.image_url}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                quality={95}
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-24 rounded-3xl bg-muted/40 flex items-center justify-center">
                  <Box className="h-12 w-12 text-muted-foreground/25" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Title block — brand caps, h1, price, chips */}
        <div className="px-4 pt-5">
          {p.brand && (
            <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-primary">
              {p.brand}
            </div>
          )}
          <h1 className="text-[20px] font-bold leading-tight tracking-tight mt-1">
            {p.name}
          </h1>

          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            {sale ? (
              <>
                <span className="text-[26px] font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                  {formatMnt(sale.net)}
                </span>
                <span className="text-[14px] tabular-nums line-through text-muted-foreground/70">
                  {formatMnt(p.effective_price)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white">
                  <Sparkles className="h-3 w-3" strokeWidth={2.4} />
                  −{sale.pct}%
                </span>
              </>
            ) : (
              <span className="text-[26px] font-bold tabular-nums tracking-tight">
                {formatMnt(p.effective_price)}
              </span>
            )}
            {p.unit && (
              <span className="text-[12px] text-muted-foreground">
                / {p.unit}
              </span>
            )}
          </div>

          {/* Sale callout — names the active rule so the buyer knows
              what's giving them the deal. Only renders when there's an
              active per-product discount matching this row. */}
          {sale && (
            <div className="mt-2 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 dark:bg-emerald-950/30 dark:ring-emerald-800/60">
              <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-emerald-700 dark:text-emerald-300">
                Хямдрал
              </div>
              <div className="text-[12.5px] font-semibold text-emerald-900 dark:text-emerald-100">
                {sale.rule.name}
              </div>
            </div>
          )}

          {/* Pack-tier chips — show all three units the buyer might be
              thinking in (single piece / pack-of-N / box-of-N). Each chip
              only renders when its number is meaningful and distinct from
              the others, so a product without packaging stays clean.
              Stock chip leads the row: availability is the first thing a
              weekly bulk-order decision hinges on. */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[12px]">
            {outOfStock ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 ring-1 ring-rose-300/60 font-bold dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800/60">
                Дууссан
              </span>
            ) : lowStock ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 ring-1 ring-amber-300/60 font-bold dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/60">
                Цөөн үлдсэн · {p.stock}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/60 font-bold dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/60">
                Бэлэн
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              <Package className="h-3 w-3" strokeWidth={2} />1 ширхэг
            </span>
            {p.pack_size && p.pack_size > 1 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                <Package className="h-3 w-3" strokeWidth={2} />
                {p.unit ?? "уут"} · {p.pack_size}ш
              </span>
            )}
            {p.box_count &&
              p.box_count > 0 &&
              p.box_count !== p.pack_size && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  <Box className="h-3 w-3" strokeWidth={2} />
                  Хайрцаг · {p.box_count}ш
                </span>
              )}
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground font-mono text-[11px]">
              SKU: {p.sku}
            </span>
          </div>
        </div>

        {/* Description — flat paragraph, no card wrapper per design */}
        {p.description && (
          <div className="px-4 pt-6">
            <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
              Тайлбар
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
              {p.description}
            </p>
          </div>
        )}
      </div>

      {/* Sticky add-to-cart bar. Sits above the bottom-tab-bar — the
          buyer shell renders the tab bar fixed at bottom with its own
          safe-area handling, so we offset by 3.5rem (h-14) + env(). */}
      <div
        className="fixed left-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur px-3 pt-3"
        style={{
          bottom: "calc(3.5rem + env(safe-area-inset-bottom))",
          paddingBottom: "12px",
        }}
      >
        <div className="max-w-2xl mx-auto">
          {outOfStock ? (
            <div className="h-12 rounded-2xl bg-muted text-muted-foreground font-bold text-[14px] flex items-center justify-center select-none">
              Энэ бараа түр дууссан байна
            </div>
          ) : (
            /* Pass the ORIGINAL list price into the cart (not the
               discounted one) so the cart engine can itemize the
               per-product discount as its own line. category_id lets
               the engine match category-wide rules. */
            <AddToCartForm
              product={{
                product_id: p.product_id,
                name: p.name,
                brand: p.brand,
                image_url: p.image_url,
                unit_price: p.effective_price,
                category_id: p.category_id,
              }}
              // CTA total surfaces the actual amount the buyer will pay
              // for this product, so it reads as the sale price even
              // though the cart stores the pre-discount unit_price.
              displayPrice={buyPrice}
              boxCount={p.box_count}
            />
          )}
        </div>
      </div>
    </div>
  );
}
