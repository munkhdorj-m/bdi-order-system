import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllParallel } from "@/lib/supabase/fetch-all";

/**
 * The distinct store types and districts already in use, for the store
 * form's suggestions. Reads every store (two small columns, paged past the
 * 1,000-row cap) so late-alphabet values like "Чингэлтэй" aren't lost.
 * Cached per request so the new + edit pages don't double-fetch.
 */
export const getSupermarketSuggestions = cache(async () => {
  const supabase = await createClient();
  const rows = await fetchAllParallel<{ type: string | null; district: string | null }>((count) =>
    supabase
      .from("supermarkets")
      .select("type, district", count ? { count: "exact" } : undefined)
      .order("id"),
  );

  const distinct = (key: "type" | "district") =>
    [...new Set(rows.map((r) => r[key]?.trim()).filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b, "mn"),
    );

  return { types: distinct("type"), districts: distinct("district") };
});
