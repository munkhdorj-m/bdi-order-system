import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PriceEditor } from "@/components/admin/price-editor";
import { savePriceList } from "../../actions";

type Params = Promise<{ id: string }>;

type ProductFromDb = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  base_price: number;
  categories: { name: string } | null;
};

type CustomPriceRow = {
  product_id: string;
  price: number;
};

export default async function SupermarketPricesPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: supermarket }, { data: products }, { data: customPrices }] =
    await Promise.all([
      supabase.from("supermarkets").select("id, name").eq("id", id).single(),
      supabase
        .from("products")
        .select("id, sku, name, brand, base_price, categories(name)")
        .eq("active", true)
        .order("name"),
      supabase
        .from("customer_prices")
        .select("product_id, price")
        .eq("supermarket_id", id),
    ]);

  if (!supermarket) notFound();

  const customMap = new Map<string, number>();
  (customPrices as CustomPriceRow[] | null)?.forEach((cp) =>
    customMap.set(cp.product_id, cp.price),
  );

  const rows = ((products as unknown as ProductFromDb[]) ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    base_price: p.base_price,
    category_name: p.categories?.name ?? null,
    custom_price: customMap.get(p.id) ?? null,
  }));

  // Diff-style summary: how many overrides, what's the average discount
  // off list. Helps the admin grok the override surface at a glance.
  const totalSkus = rows.length;
  const overrides = rows.filter((r) => r.custom_price != null).length;
  const defaults = totalSkus - overrides;
  const avgDiffPct =
    overrides > 0
      ? (
          (rows
            .filter((r) => r.custom_price != null)
            .reduce(
              (acc, r) => acc + ((r.custom_price as number) / r.base_price - 1),
              0,
            ) /
            overrides) *
          100
        ).toFixed(1)
      : "0.0";

  const save = savePriceList.bind(null, id);

  return (
    <div className="max-w-6xl">
      <Link
        href={`/admin/supermarkets/${id}`}
        className="inline-flex items-center text-[12.5px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" />
        Дэлгүүр рүү буцах
      </Link>

      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-[26px] font-bold tracking-tight">
          {supermarket.name}
        </h1>
        <span className="text-[12.5px] text-muted-foreground">
          үнийн жагсаалт
        </span>
      </div>

      {/* Diff-style summary boxes (Hi-Fi AdminPriceList) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryBox label="Нийт SKU" value={String(totalSkus)} />
        <SummaryBox
          label="Override-той"
          value={String(overrides)}
          tone="primary"
        />
        <SummaryBox
          label="Дундаж зөрүү"
          value={`${avgDiffPct}%`}
          tone="emerald"
        />
        <SummaryBox label="Default-аар" value={String(defaults)} />
      </div>

      <PriceEditor products={rows} action={save} />
    </div>
  );
}

function SummaryBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "emerald";
}) {
  const colorClass =
    tone === "primary"
      ? "text-primary"
      : tone === "emerald"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-foreground";
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-4">
      <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 text-[22px] font-bold tabular-nums tracking-tight ${colorClass}`}
      >
        {value}
      </div>
    </div>
  );
}
