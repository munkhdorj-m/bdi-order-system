import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { RepCartView } from "@/components/rep/rep-cart-view";

type Params = Promise<{ id: string }>;

/** The rep's cart for one store (the cart itself lives on the phone). */
export default async function RepCartPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: store }, priceRows] = await Promise.all([
    supabase.from("supermarkets").select("name").eq("id", id).maybeSingle(),
    // Today's prices for this store, to re-price a cart saved earlier.
    fetchAll<{ product_id: string; effective_price: number }>(() =>
      supabase
        .from("supermarket_prices")
        .select("product_id, effective_price")
        .eq("supermarket_id", id)
        .order("product_id"),
    ).catch(() => null),
  ]);
  if (!store) notFound();
  const prices = priceRows
    ? Object.fromEntries(priceRows.map((r) => [r.product_id, Number(r.effective_price) || 0]))
    : undefined;
  return <RepCartView storeId={id} storeName={store.name as string} prices={prices} />;
}
