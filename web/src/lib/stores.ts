import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllParallel } from "@/lib/supabase/fetch-all";
import { getSession, hasActiveRole } from "@/lib/auth";

/** Cache tag of the shared store list — expire it after any store change. */
export const STORES_TAG = "stores";

export type StoreListRow = {
  id: string;
  name: string;
  address: string | null;
  registry_number: string | null;
  active: boolean;
  type: string | null;
  district: string | null;
};

/** What the store pickers need. */
export type StoreOption = Pick<StoreListRow, "id" | "name" | "address" | "active">;

/**
 * EVERY store (~1,300, so two pages past the 1,000-row cap), active first
 * then by name. Read once and shared between requests: the pickers on the
 * order-entry and user pages and the store form's suggestions all need the
 * whole list, and reading it per page view was the slowest part of those
 * pages. Refreshed at once when the office changes a store (updateTag in
 * the store actions) and every 5 minutes for changes made elsewhere (the
 * Mercury import).
 */
const loadAllStores = unstable_cache(
  async (): Promise<StoreListRow[]> => {
    const admin = createAdminClient();
    const rows = await fetchAllParallel<StoreListRow>((count) =>
      admin
        .from("supermarkets")
        .select("id, name, address, registry_number, active, type, district", count ? { count: "exact" } : undefined)
        .order("active", { ascending: false })
        .order("name")
        .order("id"),
    );
    // A store added between two pages could appear twice.
    return [...new Map(rows.map((s) => [s.id, s])).values()];
  },
  ["all-stores-v1"],
  { tags: [STORES_TAG], revalidate: 300 },
);

/**
 * The whole store list, for the office only: it is read with the service
 * role and shared, so the caller's admin rights are checked here, not left
 * to row-level security.
 */
export async function getAllStores(): Promise<StoreListRow[]> {
  const session = await getSession();
  if (!session || !hasActiveRole(session.profile, "admin")) return [];
  return loadAllStores();
}

/** Every store as picker options (admin only). */
export async function fetchAllStores(): Promise<StoreOption[]> {
  const rows = await getAllStores();
  return rows.map(({ id, name, address, active }) => ({ id, name, address, active }));
}
