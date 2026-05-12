import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CategoryRow = {
  id: string;
  name: string;
};

/**
 * Categories are seeded and rarely change. React's `cache()` memoizes the
 * fetch for the duration of a single server-rendering pass, so pages with
 * sub-components (or pages that compose with layouts) hit Supabase only
 * once per request instead of N times.
 */
export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");
  return (data as CategoryRow[] | null) ?? [];
});
