import Link from "next/link";
import { Plus, Tag, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMnt } from "@/lib/format";

type DiscountKind = "product" | "threshold_bonus" | "bulk" | "bonus";

type Row = {
  id: string;
  name: string;
  kind: DiscountKind;
  pct: number | null;
  step_amount: number | null;
  step_qty: number | null;
  bonus_n: number | null;
  product_id: string | null;
  category_id: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  target_mode: "all" | "include" | "exclude" | null;
  target_price_list_ids: string[] | null;
  products: { name: string } | null;
  categories: { name: string } | null;
};

const KIND_LABELS: Record<DiscountKind, string> = {
  product: "Бараа",
  threshold_bonus: "Босгоор бэлэг",
  // Legacy values from earlier drafts — still labelled so old rows render.
  bulk: "Дүн (хуучин)",
  bonus: "Бэлэг (хуучин)",
};

const KIND_ICON: Record<DiscountKind, typeof Tag> = {
  product: Tag,
  threshold_bonus: Gift,
  bulk: Tag,
  bonus: Gift,
};

const KIND_TONE: Record<DiscountKind, string> = {
  product:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
  threshold_bonus:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  bulk: "bg-muted text-muted-foreground",
  bonus: "bg-muted text-muted-foreground",
};

function formatDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function describeRow(r: Row): string {
  if (r.kind === "product") {
    const target =
      r.products?.name ??
      (r.categories?.name ? `${r.categories.name} ангилал` : "Бүх бараа");
    return `${r.pct}% хямдрал · ${target}`;
  }
  if (r.kind === "threshold_bonus") {
    return `${formatMnt(r.step_amount ?? 0)}-аас дээш → ${r.bonus_n} ${r.products?.name ?? "?"} бэлэг`;
  }
  // Legacy formats — keep the row visible so admin can delete it.
  if (r.kind === "bulk") {
    return `${r.pct}% / ${formatMnt(r.step_amount ?? 0)} бүрт (хуучин)`;
  }
  return `${r.step_qty} авбал ${r.bonus_n} бэлэг · ${r.products?.name ?? "?"} (хуучин)`;
}

export default async function AdminDiscountsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discounts")
    .select(
      "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, active, starts_at, ends_at, target_mode, target_price_list_ids, products:product_id(name), categories:category_id(name)",
    )
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Хямдрал</h1>
          <p className="text-[13px] text-muted-foreground">
            Идэвхтэй ба хуваарьт хямдралууд
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/discounts/new">
            <Plus className="h-4 w-4" />
            Шинэ хямдрал
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>Одоогоор хямдрал байхгүй байна.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => {
            const Icon = KIND_ICON[r.kind];
            return (
              <Link
                key={r.id}
                href={`/admin/discounts/${r.id}`}
                className={`block rounded-2xl bg-card ring-1 ring-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-all ${r.active ? "" : "opacity-60"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`size-8 rounded-xl flex items-center justify-center ${KIND_TONE[r.kind]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                    {KIND_LABELS[r.kind]}
                  </span>
                  {r.active ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      идэвхтэй
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px] font-bold text-muted-foreground">
                      идэвхгүй
                    </span>
                  )}
                </div>
                <div className="text-[14px] font-bold tracking-tight line-clamp-1">
                  {r.name}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">
                  {describeRow(r)}
                </div>
                {/* Store scope chip — only for targeted rules so the
                    common all-stores case stays clean. */}
                {(r.target_mode === "include" ||
                  r.target_mode === "exclude") && (
                  <div className="mt-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 ring-1 ring-sky-300/60 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60">
                      {r.target_mode === "include"
                        ? `Зөвхөн ${r.target_price_list_ids?.length ?? 0} жагсаалт`
                        : `${r.target_price_list_ids?.length ?? 0} жагсаалтаас бусад`}
                    </span>
                  </div>
                )}
                {(r.starts_at || r.ends_at) && (
                  <div className="text-[10.5px] text-muted-foreground/80 mt-1.5 tabular-nums">
                    {formatDay(r.starts_at)} → {formatDay(r.ends_at)}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
