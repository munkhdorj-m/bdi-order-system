import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MERCURY_ENTITIES,
  MERCURY_GROUPS,
  type MercuryGroup,
  formatCount,
  formatSyncTime,
} from "@/lib/mercury";
import { allMercuryEntityStats, type MercuryEntityStats } from "@/lib/mercury-stats";

type SyncRun = {
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "partial" | "failed";
  date_from: string | null;
  date_to: string | null;
  stats: Record<string, number>;
  errors: { entity: string; chunk?: string; error: string }[];
};

const STATUS_LABEL: Record<SyncRun["status"], string> = {
  running: "Явагдаж байна",
  ok: "Амжилттай",
  partial: "Хэсэгчлэн",
  failed: "Амжилтгүй",
};

/**
 * Overview of the Mercury mirror: what was copied from app.gps.mn, how much,
 * and how fresh. Read-only — the copy is made by scripts/mercury-sync.mjs.
 */
export default async function MercuryOverviewPage() {
  const supabase = await createClient();
  // Recent runs: the newest is the status line; per type, "updated" is the
  // newest run that pulled that type.
  const { data: runData, error: runsError } = await supabase
    .from("mercury_sync_runs")
    .select("started_at, finished_at, status, date_from, date_to, stats, errors")
    .order("started_at", { ascending: false })
    .limit(50);

  let byEntity = new Map<string, MercuryEntityStats>();
  let error: string | null = runsError?.message ?? null;
  if (!error) {
    try {
      // Shared between requests until the next sync run (or 10 minutes).
      const newest = (runData as SyncRun[] | null)?.[0];
      byEntity = await allMercuryEntityStats(
        newest ? `${newest.started_at}|${newest.finished_at ?? ""}|${newest.status}` : "",
      );
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const runs = (runData as SyncRun[] | null) ?? [];
  const lastRun = runs[0];
  const syncedAt = (entity: string) => {
    const run = runs.find((r) => r.status !== "running" && r.stats && entity in r.stats);
    return run ? (run.finished_at ?? run.started_at) : null;
  };
  const total = [...byEntity.values()].reduce((s, c) => s + c.rows, 0);
  const anyApprox = [...byEntity.values()].some((c) => c.approx);

  const groups = (Object.keys(MERCURY_GROUPS) as MercuryGroup[]).map((g) => ({
    group: g,
    entities: Object.entries(MERCURY_ENTITIES).filter(([, info]) => info.group === g),
  }));

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mercury өгөгдөл</h1>
        <p className="text-sm text-muted-foreground mt-1">
          app.gps.mn-ээс хуулсан бүх өгөгдөл. Зөвхөн харах зориулалттай — энд юу ч өөрчлөгдөхгүй,
          Mercury болон манай каталог хэвээрээ.
        </p>
      </div>

      {error ? (
        <Card className="p-6 text-sm">
          <div className="font-medium mb-1">Mercury-н өгөгдлийг уншиж чадсангүй.</div>
          <p className="text-muted-foreground break-words">{error}</p>
          <p className="text-muted-foreground mt-2">
            Хүснэгт үүсээгүй бол Supabase SQL Editor дээр <code>docs/fixes/35-mercury-mirror.sql</code>-ийг
            ажиллуулаад <code>web</code> хавтаснаас <code>npm run mercury:sync</code> гэж хуулна уу.
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold tabular-nums">
                  {anyApprox && "≈"}
                  {formatCount(total)}
                </span>
                <span className="text-muted-foreground">мөр, {byEntity.size} төрөл</span>
              </div>
              {lastRun && (
                <>
                  <div className="flex items-center gap-2">
                    {lastRun.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>Сүүлд хуулсан: {formatSyncTime(lastRun.finished_at ?? lastRun.started_at)}</span>
                    <Badge variant="outline">{STATUS_LABEL[lastRun.status]}</Badge>
                  </div>
                  {lastRun.date_from && (
                    <div className="text-muted-foreground tabular-nums">
                      Түүх: {lastRun.date_from} → {lastRun.date_to}
                    </div>
                  )}
                </>
              )}
            </div>
            {lastRun && lastRun.errors.length > 0 && (
              <details className="mt-3 text-[12.5px]">
                <summary className="cursor-pointer text-amber-700 dark:text-amber-400">
                  {lastRun.errors.length} алдаа
                </summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {lastRun.errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-medium text-foreground">{e.entity}</span>
                      {e.chunk && ` ${e.chunk}`}: {e.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          <div className="space-y-6">
            {groups.map(({ group, entities }) => (
              <section key={group}>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  {MERCURY_GROUPS[group]}
                </h2>
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Төрөл</TableHead>
                        <TableHead className="text-right">Мөр</TableHead>
                        <TableHead className="hidden sm:table-cell">Хугацаа</TableHead>
                        <TableHead className="hidden md:table-cell">Шинэчилсэн</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entities.map(([entity, info]) => {
                        const c = byEntity.get(entity);
                        return (
                          <TableRow key={entity}>
                            <TableCell>
                              {c ? (
                                <Link href={`/admin/mercury/${entity}`} className="font-medium hover:underline">
                                  {info.label}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">{info.label}</span>
                              )}
                              {c && c.missing > 0 && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  {formatCount(c.missing)} Mercury-д алга
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {c ? `${c.approx ? "≈" : ""}${formatCount(c.rows)}` : "—"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">
                              {c?.firstDate ? `${c.firstDate} → ${c.lastDate}` : ""}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground tabular-nums">
                              {c ? formatSyncTime(syncedAt(entity)) : ""}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
