import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DiscountForm } from "@/components/admin/discount-form";
import { deleteDiscount, updateDiscount } from "../actions";

// Mark as server file so the inline action below is recognized.
// (page.tsx is a server component by default; no extra directive needed.)

type Params = Promise<{ id: string }>;

export default async function EditDiscountPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: discount },
    { data: products },
    { data: categories },
    { data: priceListRows },
    { data: storeListRows },
  ] = await Promise.all([
    supabase
      .from("discounts")
      .select(
        "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, active, starts_at, ends_at, notes, target_mode, target_price_list_ids",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name")
      .limit(10000),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("price_lists").select("id, name").order("name"),
    supabase
      .from("supermarkets")
      .select("price_list_id")
      .not("price_list_id", "is", null),
  ]);

  if (!discount) notFound();

  const countByList = new Map<string, number>();
  for (const row of storeListRows ?? []) {
    const plId = row.price_list_id as string;
    countByList.set(plId, (countByList.get(plId) ?? 0) + 1);
  }
  const priceLists = (priceListRows ?? []).map((pl) => ({
    id: pl.id as string,
    name: pl.name as string,
    storeCount: countByList.get(pl.id as string) ?? 0,
  }));

  const action = updateDiscount.bind(null, id);
  // Form-action signature wants (FormData) => Promise<void>. deleteDiscount
  // returns ActionState — wrap it so the form contract is satisfied; the
  // server action itself revalidates + redirects on success.
  async function del() {
    "use server";
    await deleteDiscount(id);
  }

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
        {discount.name}
      </h1>

      <DiscountForm
        defaults={discount}
        products={products ?? []}
        categories={categories ?? []}
        priceLists={priceLists}
        action={action}
        submitLabel="Хадгалах"
      />

      {/* Delete — sits in its own form so it's a separate server-action POST. */}
      <form action={del} className="mt-8 pt-6 border-t">
        <p className="text-[12px] text-muted-foreground mb-2">
          Энэ хямдралыг бүрэн устгахдаа итгэлтэй байна уу?
        </p>
        <Button type="submit" variant="destructive" size="sm">
          Устгах
        </Button>
      </form>
    </div>
  );
}
