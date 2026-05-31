import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApproveUserButton } from "@/components/admin/approve-user-button";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "admin" | "rep" | "buyer";
  active: boolean;
  supermarkets: { name: string } | null;
};

type FilterKey = "all" | "pending" | "admin" | "rep" | "buyer";

type SearchParams = Promise<{ role?: string }>;

const ROLE_LABELS: Record<UserRow["role"], string> = {
  admin: "Админ",
  rep: "Төлөөлөгч",
  buyer: "Худалдан авагч",
};

// Hi-Fi tone palette: admin = primary indigo, rep = violet, buyer = sky.
// dark: variants keep contrast in dark mode.
const ROLE_PILL: Record<UserRow["role"], string> = {
  admin:
    "bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-primary ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]",
  rep: "bg-violet-50 text-violet-700 ring-violet-300/60 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/60",
  buyer:
    "bg-sky-50 text-sky-700 ring-sky-300/60 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60",
};

function avatarInitial(u: UserRow): string {
  const source = u.full_name || u.phone || "?";
  const trimmed = source.trim();
  return trimmed[0]?.toUpperCase() ?? "?";
}

function parseFilter(v: string | undefined): FilterKey {
  if (
    v === "admin" ||
    v === "rep" ||
    v === "buyer" ||
    v === "pending"
  )
    return v;
  return "all";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filter = parseFilter(sp.role);
  const supabase = await createClient();

  // Run base query + per-role counts in parallel so the filter chips can
  // show honest tallies regardless of the active tab. `pendingCount` is the
  // number of buyers awaiting admin approval (active=false).
  const [
    { data, error },
    allCount,
    adminCount,
    repCount,
    buyerCount,
    pendingCount,
  ] = await Promise.all([
    (async () => {
      let q = supabase
        .from("profiles")
        .select(
          "id, full_name, phone, role, active, supermarkets:supermarket_id(name)",
        )
        .order("role")
        .order("created_at", { ascending: false });
      if (filter === "pending") {
        q = q.eq("active", false);
      } else if (filter !== "all") {
        q = q.eq("role", filter);
      }
      return q;
    })(),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .then((r) => r.count ?? 0),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "rep")
      .then((r) => r.count ?? 0),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "buyer")
      .then((r) => r.count ?? 0),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("active", false)
      .then((r) => r.count ?? 0),
  ]);

  const rows = (data as unknown as UserRow[]) ?? [];

  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "Бүгд", count: allCount },
    { key: "pending", label: "Хүлээгдсэн", count: pendingCount },
    { key: "admin", label: "Админ", count: adminCount },
    { key: "rep", label: "Рөп", count: repCount },
    { key: "buyer", label: "Худалдан авагч", count: buyerCount },
  ];

  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Хэрэглэгч</h1>
          <p className="text-[13px] text-muted-foreground">
            Нийт {allCount} хэрэглэгч
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="h-4 w-4" />
            Шинэ хэрэглэгч
          </Link>
        </Button>
      </div>

      {/* Helper card */}
      <Card className="mb-4 p-3 sm:p-4 bg-muted/40 text-[13px]">
        <p className="font-semibold mb-1">Шинэ хэрэглэгч нэмэхдээ:</p>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>
            Тэр хүн <span className="font-mono">/register</span> -ээр утсаараа
            бүртгүүлнэ.
          </li>
          <li>
            Эхэлж <em>Худалдан авагч</em> (хүлээгдэх) төлөвөөр бүртгэгдэнэ.
          </li>
          <li>
            Та эндээс түүний эрхийг, шаардлагатай бол дэлгүүрийг сонгож
            хадгална.
          </li>
          <li>
            Эсвэл <span className="font-mono">/admin/users/new</span> -ээр
            өөрөө шууд үүсгэнэ.
          </li>
        </ol>
      </Card>

      {/* Role filter chips — "pending" tab gets its own amber styling so the
          admin's eye lands on awaiting-approval users first. */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {tabs.map((t) => {
          const active = t.key === filter;
          const href =
            t.key === "all" ? "/admin/users" : `/admin/users?role=${t.key}`;
          const isPending = t.key === "pending";
          let chipClass: string;
          if (active && isPending) {
            chipClass =
              "bg-amber-500 text-white shadow-sm shadow-amber-500/30 dark:bg-amber-600";
          } else if (active) {
            chipClass =
              "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]";
          } else if (isPending && t.count > 0) {
            chipClass =
              "bg-amber-50 text-amber-700 ring-1 ring-amber-300/60 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60 dark:hover:bg-amber-950/60";
          } else {
            chipClass =
              "bg-muted text-muted-foreground ring-1 ring-border hover:bg-muted/80 dark:hover:bg-muted/60 hover:text-foreground";
          }
          return (
            <Link
              key={t.key}
              href={href}
              className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-all inline-flex items-center gap-1 ${chipClass}`}
            >
              {isPending && (
                <Clock className="h-3 w-3" strokeWidth={2.5} />
              )}
              {t.label}
              <span
                className={`tabular-nums ${active ? "opacity-80" : isPending && t.count > 0 ? "text-amber-700/70 dark:text-amber-300/70" : "text-foreground/60"}`}
              >
                · {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p>Хэрэглэгч алга байна.</p>
        </Card>
      ) : (
        <>
          {/* Mobile cards — Approve button sits OUTSIDE the navigating <Link>
              to keep HTML valid (no <button> inside <a>). */}
          <div className="sm:hidden space-y-2">
            {rows.map((u) => (
              <div
                key={u.id}
                className={`relative bg-card ring-1 ring-border rounded-2xl hover:shadow-sm transition-shadow ${u.active ? "" : "opacity-80"}`}
              >
                <Link
                  href={`/admin/users/${u.id}`}
                  className="block p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-gradient-to-br from-[oklch(0.7_0.13_263)] to-primary text-primary-foreground flex items-center justify-center text-[12px] font-bold shrink-0">
                      {avatarInitial(u)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">
                        {u.full_name || u.phone || u.id.slice(0, 8)}
                      </div>
                      {u.phone && u.full_name && (
                        <div className="text-[11px] text-muted-foreground font-mono truncate">
                          {u.phone}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ring-1 ${ROLE_PILL[u.role]}`}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                    {u.role === "buyer" &&
                      (u.supermarkets?.name ? (
                        <span className="text-muted-foreground truncate">
                          🏪 {u.supermarkets.name}
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 italic">
                          ⚠ Дэлгүүр тогтоогоогүй
                        </span>
                      ))}
                    {!u.active && (
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800/60 dark:text-amber-300 dark:bg-amber-950/40"
                      >
                        Хүлээгдсэн
                      </Badge>
                    )}
                  </div>
                </Link>
                {!u.active && (
                  <div className="px-3 pb-3 -mt-1 flex justify-end">
                    <ApproveUserButton
                      userId={u.id}
                      userLabel={u.full_name || u.phone || u.id.slice(0, 8)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table — Hi-Fi pattern */}
          <div className="hidden sm:block rounded-2xl bg-card ring-1 ring-border overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2.5">Нэр</th>
                  <th className="text-left px-3 py-2.5 w-32">Үүрэг</th>
                  <th className="text-left px-3 py-2.5 w-44">Холбоо</th>
                  <th className="text-left px-3 py-2.5">Дэлгүүр</th>
                  <th className="px-3 py-2.5 w-36"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-muted/40 transition-colors ${u.active ? "" : "opacity-60"}`}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="flex items-center gap-3 group/u"
                      >
                        <div className="size-9 rounded-full bg-gradient-to-br from-[oklch(0.7_0.13_263)] to-primary text-primary-foreground flex items-center justify-center text-[12px] font-bold shrink-0">
                          {avatarInitial(u)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold group-hover/u:underline truncate">
                            {u.full_name || u.phone || u.id.slice(0, 8)}
                          </div>
                          {u.phone && u.full_name && (
                            <div className="text-[11px] text-muted-foreground font-mono truncate">
                              {u.phone}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ${ROLE_PILL[u.role]}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px]">
                      {u.phone ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[12.5px]">
                      {u.role === "buyer" ? (
                        u.supermarkets?.name ?? (
                          <span className="text-muted-foreground italic">
                            Тогтоогоогүй
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {!u.active && (
                        <div className="flex items-center justify-end gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800/60 dark:text-amber-300 dark:bg-amber-950/40"
                          >
                            Хүлээгдсэн
                          </Badge>
                          <ApproveUserButton
                            userId={u.id}
                            userLabel={
                              u.full_name || u.phone || u.id.slice(0, 8)
                            }
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
