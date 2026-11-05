import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  /** Picture key from lib/category-visual.tsx (fix 38); null = guess from name. */
  icon: string | null;
};

/**
 * Categories in display order. React's `cache()` memoizes the fetch for one
 * server render, so a page and its sub-components share one query.
 *
 * `select("*")` rather than a column list: `icon` arrives with fix 38, and a
 * missing column must not blank the catalog if the code ships first.
 */
export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order")
    .order("name");
  return ((data as Array<Record<string, unknown>> | null) ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    sort_order: Number(c.sort_order) || 0,
    icon: (c.icon as string | null | undefined) ?? null,
  }));
});
