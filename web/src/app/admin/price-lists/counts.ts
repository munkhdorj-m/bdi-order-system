import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rows per price list, counted by the database in ONE request (an embedded
 * count per list). Reading the rows themselves to count them stopped at
 * Supabase's 1,000-row cap, and one count request per list meant 66
 * requests for the price-list page.
 *
 *   "price_list_items" → how many products have a price on the list
 *   "supermarkets"     → how many stores use the list
 */
export async function countPerPriceList(
  supabase: SupabaseClient,
  table: "price_list_items" | "supermarkets",
  listIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(listIds.map((id) => [id, 0]));
  if (listIds.length === 0) return counts;
  const { data, error } = await supabase.from("price_lists").select(`id, ${table}(count)`);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const counted = row[table] as { count: number }[] | null;
    counts.set(row.id as string, Number(counted?.[0]?.count ?? 0));
  }
  return counts;
}
