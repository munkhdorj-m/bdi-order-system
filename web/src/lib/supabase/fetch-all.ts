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

type CountedPage = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
}>;

/**
 * Like fetchAll, but the first page also brings the total row count and
 * the remaining pages load side by side — one extra round trip instead of
 * one per page. Any failed page throws: a quietly partial list (a store
 * missing from a picker) is worse than an error page with a retry.
 *
 * `build(count)` must return a fresh, deterministically ordered query and
 * ask for `{ count: "exact" }` when `count` is true.
 */
export async function fetchAllParallel<T>(
  build: (count: boolean) => { range(from: number, to: number): CountedPage },
  pageSize = 1000,
): Promise<T[]> {
  const first = await build(true).range(0, pageSize - 1);
  if (first.error) throw new Error(first.error.message);
  const rows = [...((first.data ?? []) as T[])];
  const pages = Math.ceil((first.count ?? rows.length) / pageSize);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      build(false).range((i + 1) * pageSize, (i + 2) * pageSize - 1),
    ),
  );
  for (const page of rest) {
    if (page.error) throw new Error(page.error.message);
    rows.push(...((page.data ?? []) as T[]));
  }
  return rows;
}
