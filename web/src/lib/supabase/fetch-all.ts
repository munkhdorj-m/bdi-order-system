/**
 * Supabase (PostgREST) answers at most 1,000 rows per request and drops
 * the rest without an error — totals, rankings and pickers then come out
 * quietly wrong. fetchAll reads page after page until a short page.
 *
 * `build` must return a FRESH query each call, with a deterministic order
 * (add `.order("id")` as a tiebreaker) so pages never overlap or skip.
 */
type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/** Rows come back typed as T (the query isn't schema-typed here). */
export async function fetchAll<T>(
  build: () => { range(from: number, to: number): Page },
  { pageSize = 1000, maxPages = 50 }: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await build().range(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return rows;
}
