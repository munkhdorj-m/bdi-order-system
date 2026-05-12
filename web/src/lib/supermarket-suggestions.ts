import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the distinct non-null values currently in supermarkets.type and
 * supermarkets.district, so the new/edit form's autocomplete suggests
 * whatever values are already in use plus our defaults.
 *
 * Cached per request so the new + edit pages don't double-fetch.
 */
export const getSupermarketSuggestions = cache(async () => {
  const supabase = await createClient();
  const [types, districts] = await Promise.all([
    supabase
      .from("supermarkets")
      .select("type")
      .not("type", "is", null)
      .order("type"),
    supabase
      .from("supermarkets")
      .select("district")
      .not("district", "is", null)
      .order("district"),
  ]);

  const distinct = (rows: { [key: string]: string | null }[] | null, key: string) =>
    Array.from(
      new Set(
        (rows ?? [])
          .map((r) => r[key])
          .filter((v): v is string => !!v && v.trim().length > 0),
      ),
    );

  return {
    types: distinct(types.data, "type"),
    districts: distinct(districts.data, "district"),
  };
});
