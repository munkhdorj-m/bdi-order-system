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

  const save = savePriceList.bind(null, id);

  return (
    <div className="max-w-5xl">
      <Link
        href={`/admin/supermarkets/${id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Дэлгүүр рүү буцах
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Үнийн жагсаалт
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{supermarket.name}</p>
      </div>

      <PriceEditor products={rows} action={save} />
    </div>
  );
}
