import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Database, Hourglass } from "lucide-react";
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
import { loadSwitchoverChecks, type SwitchoverCheck } from "@/lib/switchover";
import { minutesSince } from "@/lib/dispatch";

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

/** A copy still "running" after this long was cut off (window closed, power cut). */
const STALE_RUN_MINUTES = 180;

const CHECK_ICON: Record<SwitchoverCheck["state"], { icon: typeof CheckCircle2; tone: string; label: string }> = {
  done: { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", label: "Бэлэн" },
  todo: { icon: CircleAlert, tone: "text-amber-600 dark:text-amber-400", label: "Хийх зүйл" },
  wait: { icon: Hourglass, tone: "text-slate-500 dark:text-slate-400", label: "Гаднаас хамаарна" },
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
  const lastRunCutOff =
    lastRun?.status === "running" && minutesSince(lastRun.started_at) > STALE_RUN_MINUTES;
  // The checklist looks at the last copy that actually finished.
  const lastCopy = runs.find((r) => r.status === "ok" || r.status === "partial");
  let checks: SwitchoverCheck[] = [];
  if (!error) {
    try {
      checks = await loadSwitchoverChecks(supabase, lastCopy ? (lastCopy.finished_at ?? lastCopy.started_at) : null);
    } catch {
      checks = []; // the checklist is a help, never a reason for the page to fail
    }
  }
  const doneCount = checks.filter((c) => c.state === "done").length;
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
        <h1 className="text-2xl font-semibold tracking-tight">Mercury-гаас шилжих</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mercury-г унтраахад юу дутуу байгаа, мөн app.gps.mn-ээс хуулсан бүх өгөгдөл. Хуулбар нь зөвхөн
          харах зориулалттай — эндээс Mercury-д юу ч өөрчлөгдөхгүй.
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
          {checks.length > 0 && (
            <Card className="mb-6 gap-0 p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <h2 className="text-[15px] font-bold tracking-tight">Mercury-г унтраахад бэлэн үү?</h2>
                <span className="text-[12.5px] text-muted-foreground tabular-nums">
                  <b className="text-foreground">{doneCount}</b> / {checks.length} бэлэн
                </span>
              </div>
              <ul className="divide-y">
                {checks.map((c) => {
                  const { icon: Icon, tone, label } = CHECK_ICON[c.state];
                  return (
                    <li key={c.key} className="flex gap-3 px-4 py-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} aria-label={label} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold leading-snug">{c.title}</div>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{c.detail}</p>
                      </div>
                      {c.href && c.state !== "done" && (
                        <Link
                          href={c.href}
                          className="inline-flex h-9 shrink-0 items-center gap-1 self-center rounded-xl bg-card px-3 text-[12.5px] font-semibold ring-1 ring-border hover:bg-accent/60"
                        >
                          {c.linkLabel ?? "Нээх"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="border-t bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground">
                Шилжих дараалал, өдөр тутмын ажил алхам алхмаар: <code>docs/mercury-switchover.md</code>
              </div>
            </Card>
          )}

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
                    <Badge variant="outline">{lastRunCutOff ? "Тасарсан" : STATUS_LABEL[lastRun.status]}</Badge>
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
