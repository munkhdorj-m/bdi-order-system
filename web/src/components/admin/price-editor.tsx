"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  base_price: number;
  category_name: string | null;
  custom_price: number | null;
};

type ActionState = { error?: string; ok?: boolean };

type Props = {
  products: ProductRow[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

type TabKey = "overrides" | "all";

function formatMnt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
}

function diffPercent(custom: number | null, base: number): string | null {
  if (custom == null || base <= 0) return null;
  const pct = ((custom / base) - 1) * 100;
  if (pct === 0) return "0%";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Per-store price editor laid out per the Hi-Fi AdminPriceList:
 *   - Search input + tab filter (overrides-only / all)
 *   - Bulk action: "−5% бөөнөөр" applies a percentage to every visible row
 *   - Override rows get a primary-tinted background + primary-ring input;
 *     "default" rows show a muted italic placeholder so the admin can
 *     tell at a glance which prices are overridden vs inherited
 *   - Δ column shows the diff% next to each row
 */
export function PriceEditor({ products, action }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const result = await action(prev, fd);
      return result.error ? result : { ok: true };
    },
    {},
  );
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("overrides");

  // Track per-row "is this currently an override?" via state so toggling the
  // tab filter responds to user edits within the same session, not just the
  // server-rendered snapshot. Map: product_id → number (typed value) | null.
  const initialValues = useMemo(() => {
    const map = new Map<string, number | null>();
    products.forEach((p) => map.set(p.id, p.custom_price));
    return map;
  }, [products]);
  const [values, setValues] = useState<Map<string, number | null>>(
    () => new Map(initialValues),
  );

  // Refs to each row's input so the bulk-discount action can write straight
  // through the DOM (keeps native form submission semantics intact).
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const overridesCount = useMemo(
    () => Array.from(values.values()).filter((v) => v != null).length,
    [values],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      // Tab filter
      if (tab === "overrides" && values.get(p.id) == null) return false;
      // Search filter
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, query, tab, values]);

  function handleRowChange(id: string, raw: string) {
    const next = new Map(values);
    if (raw === "") {
      next.set(id, null);
    } else {
      const n = Math.max(0, Math.floor(Number(raw)) || 0);
      next.set(id, n);
    }
    setValues(next);
  }

  function applyBulkDiscount(pct: number) {
    // pct is signed (-5 = −5%). Applies only to currently visible rows.
    const next = new Map(values);
    for (const p of filtered) {
      const base = p.base_price;
      const newPrice = Math.max(0, Math.round(base * (1 + pct / 100)));
      next.set(p.id, newPrice);
      const el = inputRefs.current.get(p.id);
      if (el) el.value = String(newPrice);
    }
    setValues(next);
  }

  function resetToDefaults() {
    const next = new Map(values);
    for (const p of filtered) {
      next.set(p.id, null);
      const el = inputRefs.current.get(p.id);
      if (el) el.value = "";
    }
    setValues(next);
  }

  return (
    <form action={formAction} className="space-y-3">
      {/* Tabs + bulk actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setTab("overrides")}
          className={`h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1 transition-all ${
            tab === "overrides"
              ? "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
              : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-[oklch(0.95_0.005_264)]"
          }`}
        >
          Зөвхөн зөрүү
          <span
            className={`tabular-nums ${tab === "overrides" ? "opacity-80" : "text-foreground/60"}`}
          >
            · {overridesCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1 transition-all ${
            tab === "all"
              ? "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
              : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-[oklch(0.95_0.005_264)]"
          }`}
        >
          Бүгд
          <span
            className={`tabular-nums ${tab === "all" ? "opacity-80" : "text-foreground/60"}`}
          >
            · {products.length}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyBulkDiscount(-5)}
            disabled={filtered.length === 0}
            title="Шүүсэн мөрүүдэд −5% хямдрал нэмэх"
          >
            −5% бөөнөөр
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            disabled={filtered.length === 0}
            title="Шүүсэн мөрүүдийн override-ийг арилгах"
          >
            ↺ Default рүү
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Барааны нэр, SKU, бренд..."
            className="pl-9"
          />
        </div>
      </Card>

      {/* Diff-style table */}
      <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-2.5">Бараа</th>
              <th className="text-right px-3 py-2.5 w-32">Жишиг үнэ</th>
              <th className="text-left px-3 py-2.5 w-48">
                Энэ дэлгүүрийн үнэ
              </th>
              <th className="text-right px-3 py-2.5 w-24">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => {
              const current = values.get(p.id);
              const isOverride = current != null;
              const diff = diffPercent(current ?? null, p.base_price);
              return (
                <tr
                  key={p.id}
                  className={
                    isOverride
                      ? "bg-[color-mix(in_oklch,var(--primary)_4%,var(--card))]"
                      : ""
                  }
                >
                  <td className="px-5 py-3">
                    <div className="font-semibold leading-tight">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {p.brand ? `${p.brand} · ` : ""}
                      <span className="font-mono">{p.sku}</span>
                      {p.category_name && <> · {p.category_name}</>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                    {formatMnt(p.base_price)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="relative w-36">
                      <input
                        ref={(el) => {
                          inputRefs.current.set(p.id, el);
                        }}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        name={`price_${p.id}`}
                        defaultValue={current ?? ""}
                        placeholder={`default · ${p.base_price}`}
                        onChange={(e) => handleRowChange(p.id, e.target.value)}
                        className={`w-full h-9 rounded-lg px-3 text-[13px] font-bold tabular-nums text-right transition-all outline-none focus:ring-3 focus:ring-primary/30 ${
                          isOverride
                            ? "bg-card ring-2 ring-primary text-foreground"
                            : "bg-muted ring-1 ring-border text-muted-foreground placeholder:italic placeholder:font-normal placeholder:text-muted-foreground/70"
                        }`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {diff ? (
                      <span
                        className={`text-[12px] font-bold tabular-nums ${
                          diff.startsWith("-")
                            ? "text-emerald-700 dark:text-emerald-300"
                            : diff === "0%"
                              ? "text-muted-foreground"
                              : "text-rose-600 dark:text-rose-300"
                        }`}
                      >
                        {diff}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  {tab === "overrides" && query === ""
                    ? "Override-той бараа алга байна."
                    : "Бараа олдсонгүй."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && !pending && (
        <Callout tone="success">✓ Үнийн жагсаалт хадгалагдлаа.</Callout>
      )}

      <div className="sticky bottom-4 flex items-center gap-2 justify-end">
        <p className="text-[11px] text-muted-foreground mr-auto max-w-md leading-relaxed">
          Тайлбар: оруулга хоосон үлдэвэл жишиг (бөөний) үнэ ашиглагдана. Өөрөөр
          оруулсан үнэ тухайн дэлгүүрт зөвхөн хүчинтэй.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Хадгалж байна..." : "Бүх өөрчлөлтийг хадгалах"}
        </Button>
      </div>
    </form>
  );
}
