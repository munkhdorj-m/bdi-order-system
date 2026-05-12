import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { AddToCartForm } from "@/components/buyer/add-to-cart-form";
import { formatMnt } from "@/lib/format";

type Params = Promise<{ id: string }>;

type PriceRow = {
  product_id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  effective_price: number;
  unit: string | null;
  box_count: number | null;
  description: string | null;
};

export default async function ProductDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const session = await requireSession();
  const supermarketId = session.profile.supermarket_id!;

  const supabase = await createClient();

  // Pull effective price from the view, then enrich with description/unit
  const [{ data: priced }, { data: extras }] = await Promise.all([
    supabase
      .from("supermarket_prices")
      .select(
        "product_id, sku, name, brand, image_url, effective_price, unit, box_count",
      )
      .eq("supermarket_id", supermarketId)
      .eq("product_id", id)
      .single(),
    supabase
      .from("products")
      .select("description")
      .eq("id", id)
      .single(),
  ]);

  if (!priced) notFound();

  const p = { ...(priced as PriceRow), description: extras?.description ?? null };

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="aspect-square bg-muted relative">
        {p.image_url ? (
          <Image
            src={p.image_url}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            quality={95}
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Зураг алга
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-4">
        <div>
          {p.brand && (
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {p.brand}
            </div>
          )}
          <h1 className="text-xl font-semibold leading-tight">{p.name}</h1>
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

        {p.box_count && (
          <div className="text-sm text-muted-foreground">
            Хайрцагт {p.box_count} ширхэг
          </div>
        )}

        <AddToCartForm
          product={{
            product_id: p.product_id,
            name: p.name,
            brand: p.brand,
            image_url: p.image_url,
            unit_price: p.effective_price,
          }}
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
    </div>
  );
}
