import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import { ProductForm } from "@/components/admin/product-form";
import { updateProduct } from "../actions";

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, categories] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, sku, name, category_id, brand, description, unit, pack_size, box_count, base_price, cash_price, stock, image_url, active",
      )
      .eq("id", id)
      .single(),
    getCategories(),
  ]);

  if (!product) notFound();

  const updateProductWithId = updateProduct.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Бараа жагсаалт руу
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">{product.name}</h1>
      <p className="text-sm text-muted-foreground font-mono mb-6">{product.sku}</p>

      <ProductForm
        categories={categories}
        defaults={product}
        action={updateProductWithId}
        submitLabel="Хадгалах"
      />
    </div>
  );
}
