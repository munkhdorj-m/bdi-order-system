import { createClient } from "@/lib/supabase/server";
import { fetchAllParallel } from "@/lib/supabase/fetch-all";

export type StoreOption = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
};

/**
 * EVERY supermarket for the store pickers (~1,300, so past the 1,000-row
 * cap of one request): the first page brings the count, the rest load in
 * parallel. Active first, then by name, id as the tiebreaker so pages
 * never skip or repeat a row.
 */
export async function fetchAllStores(): Promise<StoreOption[]> {
  const supabase = await createClient();
  const rows = await fetchAllParallel<StoreOption>((count) =>
    supabase
      .from("supermarkets")
      .select("id, name, address, active", count ? { count: "exact" } : undefined)
      .order("active", { ascending: false })
      .order("name")
      .order("id"),
  );
  // A store added between two pages could appear twice.
  return [...new Map(rows.map((s) => [s.id, s])).values()];
}
