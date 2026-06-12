import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DiscountForm } from "@/components/admin/discount-form";
import { createDiscount } from "../actions";

export default async function NewDiscountPage() {
  const supabase = await createClient();
  const [
    { data: products },
    { data: categories },
    { data: priceListRows },
    { data: storeListRows },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name")
      .limit(500),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("price_lists").select("id, name").order("name"),
    supabase
      .from("supermarkets")
      .select("price_list_id")
      .not("price_list_id", "is", null),
  ]);

  // Store count per price list — shown in the scope picker so the admin
  // sees the blast radius of each chain before targeting it.
  const countByList = new Map<string, number>();
  for (const row of storeListRows ?? []) {
    const id = row.price_list_id as string;
    countByList.set(id, (countByList.get(id) ?? 0) + 1);
  }
  const priceLists = (priceListRows ?? []).map((pl) => ({
    id: pl.id as string,
    name: pl.name as string,
    storeCount: countByList.get(pl.id as string) ?? 0,
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
        products={products ?? []}
        categories={categories ?? []}
        priceLists={priceLists}
        action={createDiscount}
        submitLabel="Үүсгэх"
      />
    </div>
  );
}
