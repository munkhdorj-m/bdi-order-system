import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
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

type PriceRow = {
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

  const [{ data: supermarket }, products, customPrices] = await Promise.all([
    supabase
      .from("supermarkets")
      .select("id, name, price_list_id, list:price_list_id(name)")
      .eq("id", id)
      .single(),
    fetchAll<ProductFromDb>(() =>
      supabase
        .from("products")
        .select("id, sku, name, brand, base_price, categories(name)")
        .eq("active", true)
        .order("name")
        .order("id"),
    ),
    fetchAll<PriceRow>(() =>
      supabase.from("customer_prices").select("product_id, price").eq("supermarket_id", id).order("product_id"),
    ),
  ]);

  if (!supermarket) notFound();
  const store = supermarket as unknown as {
    id: string;
    name: string;
    price_list_id: string | null;
    list: { name: string } | null;
  };

  // Without its own price, a store pays its price list's price — or the
  // base price when the list has none. That is what an override replaces,
  // so it's the "default" shown and the base of Δ%.
  const listPrices = store.price_list_id
    ? await fetchAll<PriceRow>(() =>
        supabase
          .from("price_list_items")
          .select("product_id, price")
          .eq("price_list_id", store.price_list_id!)
          .order("product_id"),
      )
    : [];
  const listMap = new Map(listPrices.map((p) => [p.product_id, Number(p.price)]));
  const customMap = new Map(customPrices.map((cp) => [cp.product_id, Number(cp.price)]));

  const rows = products.map((p) => {
    const listPrice = listMap.get(p.id);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      ref_price: listPrice ?? (Number(p.base_price) || 0),
      ref_note: store.price_list_id ? (listPrice !== undefined ? "жагсаалт" : "жишиг") : null,
      category_name: p.categories?.name ?? null,
      custom_price: customMap.get(p.id) ?? null,
    };
  });

  // Summary: how many own prices, average difference from what the store
  // would pay otherwise.
  const totalSkus = rows.length;
  const withOwn = rows.filter((r) => r.custom_price != null && r.ref_price > 0);
  const overrides = rows.filter((r) => r.custom_price != null).length;
  const defaults = totalSkus - overrides;
  const avgDiffPct =
    withOwn.length > 0
      ? (
          (withOwn.reduce((acc, r) => acc + ((r.custom_price as number) / r.ref_price - 1), 0) / withOwn.length) *
          100
        ).toFixed(1)
      : "0.0";

  const save = savePriceList.bind(null, id);
  const refLabel = store.list ? "Жагсаалтын үнэ" : "Жишиг үнэ";

  return (
    <div className="max-w-6xl">
      <Link
        href={`/admin/supermarkets/${id}`}
        className="inline-flex items-center text-[12.5px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-4 w-4" />
        Дэлгүүр рүү буцах
      </Link>

      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h1 className="text-[26px] font-bold tracking-tight">{store.name}</h1>
        <span className="text-[12.5px] text-muted-foreground">тусгай үнэ</span>
      </div>
      <p className="mb-4 text-[13px] text-muted-foreground">
        Үнийн жагсаалт:{" "}
        {store.list && store.price_list_id ? (
          <Link href={`/admin/price-lists/${store.price_list_id}`} className="font-semibold text-foreground hover:underline">
            {store.list.name}
          </Link>
        ) : (
          <span className="font-semibold text-foreground">Жишиг үнэ</span>
        )}
        . Энд оруулсан үнэ зөвхөн энэ дэлгүүрт хүчинтэй бөгөөд жагсаалтын үнээс давуу.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryBox label="Нийт бараа" value={String(totalSkus)} />
        <SummaryBox label="Тусгай үнэтэй" value={String(overrides)} tone="primary" />
        <SummaryBox label="Дундаж зөрүү" value={`${avgDiffPct}%`} tone="emerald" />
        <SummaryBox label={store.list ? "Жагсаалтын үнээр" : "Жишиг үнээр"} value={String(defaults)} />
      </div>

      <PriceEditor
        products={rows}
        action={save}
        refLabel={refLabel}
        priceLabel="Энэ дэлгүүрийн үнэ"
        note={`Хоосон үлдээвэл ${store.list ? `«${store.list.name}» жагсаалтын` : "жишиг (бөөний)"} үнэ ашиглагдана. Оруулсан үнэ зөвхөн энэ дэлгүүрт хүчинтэй.`}
      />
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
        className={`mt-1.5 font-display text-[20px] font-semibold tabular-nums tracking-tight ${colorClass}`}
      >
        {value}
      </div>
    </div>
  );
}
