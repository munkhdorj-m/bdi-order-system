import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rows per price list, counted by the database — one head-only request per
 * list, side by side. Reading the rows themselves to count them stopped at
 * Supabase's 1,000-row cap (≈300 products × every list, ≈1,300 stores), so
 * the numbers on screen came out quietly too small.
 *
 *   "price_list_items" → how many products have a price on the list
 *   "supermarkets"     → how many stores use the list
 */
export async function countPerPriceList(
  supabase: SupabaseClient,
  table: "price_list_items" | "supermarkets",
  listIds: string[],
): Promise<Map<string, number>> {
  const counts = await Promise.all(
    listIds.map(async (id) => {
      const { count, error } = await supabase
        .from(table)
        .select("price_list_id", { count: "exact", head: true })
        .eq("price_list_id", id);
      if (error) throw new Error(error.message);
      return [id, count ?? 0] as const;
    }),
  );
  return new Map(counts);
}
