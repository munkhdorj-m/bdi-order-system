import "server-only";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MERCURY_ENTITIES } from "@/lib/mercury";

/**
 * Per-type numbers for the Mercury mirror pages (row count, date span,
 * rows deleted in Mercury).
 *
 * One aggregate over the whole mirror (~185k rows, the
 * `mercury_entity_counts` view) runs past Supabase's 8-second statement
 * limit, so every number here comes from a small index-backed query per
 * record type instead:
 *   - rows: exact count on the (entity, mercury_key) primary key, falling
 *     back to Postgres's own estimate (marked `approx`) if it ever times out;
 *   - first/last date: one row each from the (entity, record_date) index;
 *   - deleted in Mercury: only lists are ever flagged, and lists are small.
 *
 * Runs with the service role so RLS's per-row admin check doesn't execute
 * 143k times on the big tables — which is why each call re-checks that the
 * viewer is an admin first.
 */

export type MercuryEntityStats = {
  entity: string;
  rows: number;
  /** True when the exact count timed out and `rows` is Postgres's estimate. */
  approx: boolean;
  missing: number;
  firstDate: string | null;
  lastDate: string | null;
};

type Db = ReturnType<typeof createAdminClient>;

async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (session?.profile.role !== "admin") {
    throw new Error("Зөвхөн админ харах боломжтой.");
  }
}

async function countRows(db: Db, entity: string): Promise<{ rows: number; approx: boolean }> {
  const exact = await db
    .from("mercury_records")
    .select("entity", { count: "exact", head: true })
    .eq("entity", entity);
  if (!exact.error) return { rows: exact.count ?? 0, approx: false };
  const planned = await db
    .from("mercury_records")
    .select("entity", { count: "planned", head: true })
    .eq("entity", entity);
  if (!planned.error) return { rows: planned.count ?? 0, approx: true };
  throw new Error(planned.error.message || exact.error.message || "mercury_records уншиж чадсангүй");
}

async function edgeDate(db: Db, entity: string, ascending: boolean): Promise<string | null> {
  const { data, error } = await db
    .from("mercury_records")
    .select("record_date")
    .eq("entity", entity)
    .not("record_date", "is", null)
    .order("record_date", { ascending })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0]?.record_date as string | undefined) ?? null;
}

async function missingCount(db: Db, entity: string): Promise<number> {
  const { count, error } = await db
    .from("mercury_records")
    .select("entity", { count: "exact", head: true })
    .eq("entity", entity)
    .not("missing_since", "is", null);
  return error ? 0 : (count ?? 0);
}

async function statsFor(db: Db, entity: string): Promise<MercuryEntityStats> {
  // History is never flagged as deleted (only lists are), so skip that count there.
  const dated = MERCURY_ENTITIES[entity]?.dated ?? false;
  const [count, firstDate, lastDate, missing] = await Promise.all([
    countRows(db, entity),
    dated ? edgeDate(db, entity, true) : null,
    dated ? edgeDate(db, entity, false) : null,
    dated ? 0 : missingCount(db, entity),
  ]);
  return { entity, ...count, missing, firstDate, lastDate };
}

/** Numbers for one record type. */
export async function mercuryEntityStats(entity: string): Promise<MercuryEntityStats> {
  await requireAdmin();
  return statsFor(createAdminClient(), entity);
}

/** Numbers for every record type that has rows, keyed by entity. */
export async function allMercuryEntityStats(): Promise<Map<string, MercuryEntityStats>> {
  await requireAdmin();
  const db = createAdminClient();
  const entities = Object.keys(MERCURY_ENTITIES);
  const results: MercuryEntityStats[] = [];
  // A few record types at a time keeps ~70 small queries gentle on a small database.
  let next = 0;
  async function worker() {
    while (next < entities.length) {
      const entity = entities[next++];
      results.push(await statsFor(db, entity));
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return new Map(results.filter((s) => s.rows > 0).map((s) => [s.entity, s]));
}
