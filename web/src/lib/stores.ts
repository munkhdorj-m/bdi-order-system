import { createClient } from "@/lib/supabase/server";

export type StoreOption = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
};

/**
 * Fetch EVERY supermarket, paging past the PostgREST/Supabase per-request
 * row ceiling.
 *
 * A single `.limit(n)` is silently clamped to the project's "max rows"
 * setting (commonly 1000), so a one-shot query can never return more than
 * that — which hid later-alphabet stores from the user-assignment picker
 * once the catalog passed ~1000 stores. Here we request in pages and
 * advance by however many rows actually came back (so it's correct even
 * if the server caps a page below PAGE), stopping when a page is empty.
 *
 * Sorted active-first, then name, with id as a stable tiebreaker so the
 * paging windows never skip or duplicate a row when names collide.
 */
export async function fetchAllStores(): Promise<StoreOption[]> {
  const supabase = await createClient();
  const PAGE = 1000;
  const MAX_PAGES = 50; // safety stop: 50k stores
  const all: StoreOption[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = all.length;
    const { data, error } = await supabase
      .from("supermarkets")
      .select("id, name, address, active")
      .order("active", { ascending: false })
      .order("name")
      .order("id")
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;
    all.push(...(data as StoreOption[]));
    // Stop only on an empty page. We advance `from` by the actual rows
    // returned (all.length), so this stays correct even if the server
    // caps a page below PAGE — we never break early and miss rows.
  }

  return all;
}
