import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MercuryTable, type MercuryRow } from "@/components/admin/mercury-table";
import {
  MERCURY_ENTITIES,
  entityLabel,
  formatCount,
  monthRange,
  monthsBetween,
  scalarColumns,
} from "@/lib/mercury";
import { mercuryEntityStats } from "@/lib/mercury-stats";

type Params = Promise<{ entity: string }>;
type SearchParams = Promise<{ month?: string; page?: string }>;

type RecordRow = {
  mercury_key: string;
  record_date: string | null;
  missing_since: string | null;
  data: Record<string, unknown>;
};

/** Supabase caps a single select at 1,000 rows. */
const BATCH = 1000;
/** Rows per page for month-by-month history. */
const PAGE = 100;

/** Products keep their 33 prices nested; surface the base price as a column. */
function display(entity: string, data: Record<string, unknown>): Record<string, unknown> {
  if (entity === "product" && data.prices && typeof data.prices === "object") {
    return { ...data, "Үндсэн үнэ": (data.prices as Record<string, unknown>)["Үндсэн үнэ"] };
  }
  return data;
}

function toRows(entity: string, records: RecordRow[]): MercuryRow[] {
  return records.map((r) => ({
    key: r.mercury_key,
    date: r.record_date,
    missing: r.missing_since != null,
    data: display(entity, r.data),
  }));
}

/**
 * Browse one Mercury record type. Lists (products, customers, …) load whole
 * with an instant filter; history (documents, orders, BigData lines) is paged
 * month by month because it runs to tens of thousands of rows.
 */
export default async function MercuryEntityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { entity } = await params;
  const info = MERCURY_ENTITIES[entity];
  if (!info) notFound();
  const sp = await searchParams;
  const supabase = await createClient();

  const back = (
    <Link
      href="/admin/mercury"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
    >
      <ChevronLeft className="h-4 w-4" />
      Mercury-гаас шилжих
    </Link>
  );

  if (!info.dated) {
    const records: RecordRow[] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await supabase
        .from("mercury_records")
        .select("mercury_key, record_date, missing_since, data")
        .eq("entity", entity)
        .order("mercury_key")
        .range(from, from + BATCH - 1);
      if (error) throw new Error(error.message);
      records.push(...((data as RecordRow[] | null) ?? []));
      if (!data || data.length < BATCH) break;
    }
    const rows = toRows(entity, records);
    return (
      <div className="max-w-full">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight mb-1">{entityLabel(entity)}</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Mercury-с хуулсан {formatCount(rows.length)} мөр. Мөр бүрийн “JSON”-оос бүх талбарыг харна.
        </p>
        <MercuryTable rows={rows} columns={scalarColumns(rows.map((r) => r.data))} filterable />
      </div>
    );
  }

  // ---- dated history: month picker + pages ----
  const span = await mercuryEntityStats(entity);
  const months = span.firstDate && span.lastDate ? monthsBetween(span.firstDate, span.lastDate) : [];
  const month = sp.month && months.includes(sp.month) ? sp.month : months[0];
  const page = Math.max(1, Number(sp.page) || 1);

  let rows: MercuryRow[] = [];
  let monthTotal = 0;
  if (month) {
    const [start, end] = monthRange(month);
    const { data, count, error } = await supabase
      .from("mercury_records")
      .select("mercury_key, record_date, missing_since, data", { count: "exact" })
      .eq("entity", entity)
      .gte("record_date", start)
      .lte("record_date", end)
      .order("record_date", { ascending: false })
      .order("mercury_key", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (error) throw new Error(error.message);
    rows = toRows(entity, (data as RecordRow[] | null) ?? []);
    monthTotal = count ?? rows.length;
  }
  const pages = Math.max(1, Math.ceil(monthTotal / PAGE));
  const href = (m: string, p = 1) => `/admin/mercury/${entity}?month=${m}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="max-w-full">
      {back}
      <h1 className="text-2xl font-semibold tracking-tight mb-1">{entityLabel(entity)}</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Нийт {span.approx && "≈"}
        {formatCount(span.rows)} мөр
        {month && ` · ${month}: ${formatCount(monthTotal)}`}
      </p>

      {months.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Өгөгдөл алга.</Card>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
            {months.map((m) => (
              <Link
                key={m}
                href={href(m)}
                className="chip tabular-nums"
                data-active={m === month || undefined}
              >
                {m}
              </Link>
            ))}
          </div>

          <MercuryTable rows={rows} columns={scalarColumns(rows.map((r) => r.data))} filterable={false} />

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {page} / {pages} хуудас
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                  <Link href={href(month!, Math.max(1, page - 1))} aria-disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Өмнөх
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" disabled={page >= pages}>
                  <Link href={href(month!, Math.min(pages, page + 1))} aria-disabled={page >= pages}>
                    Дараах
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
