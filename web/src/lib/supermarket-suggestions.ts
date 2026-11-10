import { cache } from "react";
import { getAllStores } from "@/lib/stores";

/**
 * The distinct store types and districts already in use, for the store
 * form's suggestions. Taken from the shared store list (lib/stores.ts), so
 * it costs no query of its own.
 */
export const getSupermarketSuggestions = cache(async () => {
  const rows = await getAllStores();
  const distinct = (key: "type" | "district") =>
    [...new Set(rows.map((r) => r[key]?.trim()).filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b, "mn"),
    );
  return { types: distinct("type"), districts: distinct("district") };
});
