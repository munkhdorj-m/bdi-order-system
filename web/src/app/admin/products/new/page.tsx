import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Бараа жагсаалт руу
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Шинэ бараа</h1>
      <ProductForm
        categories={categories ?? []}
        action={createProduct}
        submitLabel="Хадгалах"
      />
    </div>
  );
}
