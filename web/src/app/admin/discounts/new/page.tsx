import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DiscountForm } from "@/components/admin/discount-form";
import { createDiscount } from "../actions";

export default async function NewDiscountPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name")
      .limit(500),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

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
        action={createDiscount}
        submitLabel="Үүсгэх"
      />
    </div>
  );
}
