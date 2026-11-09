import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { DiscountForm, type ProductOption } from "@/components/admin/discount-form";
import { countPerPriceList } from "../../price-lists/counts";
import { createDiscount } from "../actions";

export default async function NewDiscountPage() {
  const supabase = await createClient();
  const [products, { data: categories }, { data: priceListRows }] = await Promise.all([
    fetchAll<ProductOption>(() =>
      supabase.from("products").select("id, name, sku").eq("active", true).order("name").order("id"),
    ),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("price_lists").select("id, name").order("name"),
  ]);

  // Store count per price list — shown in the scope picker so the admin
  // sees the blast radius of each chain before targeting it. Counted in
  // the database (reading every store stopped at 1,000 rows).
  const lists = (priceListRows ?? []) as { id: string; name: string }[];
  const countByList = await countPerPriceList(supabase, "supermarkets", lists.map((l) => l.id));
  const priceLists = lists.map((pl) => ({
    id: pl.id,
    name: pl.name,
    storeCount: countByList.get(pl.id) ?? 0,
  }));

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/discounts"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Хямдрал жагсаалт руу
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Шинэ хямдрал
      </h1>
      <DiscountForm
        products={products}
        categories={categories ?? []}
        priceLists={priceLists}
        action={createDiscount}
        submitLabel="Үүсгэх"
      />
    </div>
  );
}
