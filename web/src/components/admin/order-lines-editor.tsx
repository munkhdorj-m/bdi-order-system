"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Minus, Pencil, Plus, Save, Search, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMnt } from "@/lib/format";
import { searchNormalize } from "@/lib/translit";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-method";
import { correctOrderLines } from "@/app/admin/orders/actions";
import { loadStoreCatalog, type CatalogRow } from "@/app/admin/orders/new/actions";

export type EditorLine = {
  id: string;
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

type Draft = {
  product_id: string;
  name: string;
  unit_price: number;
  /** Quantity on the order now; 0 for a product being added. */
  was: number;
  qty: number;
};

const REASONS = ["Хүргэлтээр дутуу", "Дэлгүүр өөрчилсөн", "Нөөц дууссан", "Буцаалт", "Алдаа зассан"];

/**
 * − [n] + and take-off / put-back for one line. `roomy` is the phone
 * size: 44px targets, on a row of their own under the product's name.
 */
function QtyStepper({
  row,
  onChange,
  disabled,
  roomy = false,
}: {
  row: Draft;
  onChange: (productId: string, qty: number) => void;
  disabled: boolean;
  roomy?: boolean;
}) {
  const box = roomy ? "size-11" : "h-9 w-9";
  const off = row.qty === 0;
  return (
    <div className={cn("flex items-center gap-1", roomy ? "justify-start gap-1.5" : "justify-center")}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={box}
        onClick={() => onChange(row.product_id, row.qty - 1)}
        disabled={disabled || row.qty <= 0}
        aria-label={`${row.name} нэгээр хасах`}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={off ? "" : row.qty}
        placeholder="0"
        onChange={(e) => onChange(row.product_id, Number(e.target.value))}
        disabled={disabled}
        className={cn("text-center tabular-nums", roomy ? "h-11 w-20 font-semibold" : "h-9 w-16")}
        aria-label={`${row.name} тоо`}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={box}
        onClick={() => onChange(row.product_id, row.qty + 1)}
        disabled={disabled}
        aria-label={`${row.name} нэгээр нэмэх`}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      {off ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(box, "text-muted-foreground")}
          onClick={() => onChange(row.product_id, row.was)}
          disabled={disabled}
          aria-label={`${row.name} буцааж оруулах`}
          title="Буцааж оруулах"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(box, "text-muted-foreground")}
          onClick={() => onChange(row.product_id, 0)}
          disabled={disabled}
          aria-label={`${row.name} хасах`}
          title="Захиалгаас хасах"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * The order's lines, with "Засах": change quantities, take a product off
 * or add one after the order was placed (Mercury's delivered-vs-ordered).
 * Saved in one step by the server, which also keeps the history.
 */
export function OrderLinesEditor({
  orderId,
  storeId,
  updatedAt,
  lines,
  subtotal,
  discountTotal,
  paymentMethod,
  orderedTotal,
  lockedReason,
  hasDeals,
}: {
  orderId: string;
  storeId: string;
  /** orders.updated_at — a save is refused if the order changed since. */
  updatedAt: string;
  lines: EditorLine[];
  subtotal: number;
  discountTotal: number;
  paymentMethod: PaymentMethod | null;
  /** What the store ordered, once the order has been corrected. */
  orderedTotal: number | null;
  /** Why the order can't be corrected right now (null = it can). */
  lockedReason: string | null;
  /** A store's own order: its discount and gifts are worked out again on save. */
  hasDeals: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [reason, setReason] = useState("");
  const [saving, startSaving] = useTransition();

  // Adding a product: the store's catalog, fetched the first time it's needed.
  const [picker, setPicker] = useState(false);
  const [catalog, setCatalog] = useState<CatalogRow[] | null>(null);
  const [loadingCatalog, startLoading] = useTransition();
  const [search, setSearch] = useState("");

  const paid = lines.filter((l) => Number(l.unit_price) > 0);
  const gifts = lines.filter((l) => Number(l.unit_price) === 0);
  const editing = draft !== null;
  const total = Math.max(0, subtotal - discountTotal);

  function startEdit() {
    // One row per product, like the server sees it.
    const rows = new Map<string, Draft>();
    for (const l of paid) {
      const cur = rows.get(l.product_id);
      if (cur) {
        cur.qty += l.qty;
        cur.was += l.qty;
      } else {
        rows.set(l.product_id, { product_id: l.product_id, name: l.name, unit_price: Number(l.unit_price), was: l.qty, qty: l.qty });
      }
    }
    setDraft([...rows.values()]);
    setReason("");
    setPicker(false);
    setSearch("");
  }

  function setQty(productId: string, qty: number) {
    const clean = Math.max(0, Math.min(100_000, Math.floor(Number.isFinite(qty) ? qty : 0)));
    setDraft((rows) =>
      (rows ?? [])
        // A product added by mistake just disappears; one from the order stays, struck through.
        .filter((r) => !(r.product_id === productId && r.was === 0 && clean === 0))
        .map((r) => (r.product_id === productId ? { ...r, qty: clean } : r)),
    );
  }

  function openPicker() {
    setPicker(true);
    if (catalog || loadingCatalog) return;
    startLoading(async () => {
      const r = await loadStoreCatalog(storeId);
      if (r.error) {
        toast.error(r.error);
        setPicker(false);
        return;
      }
      setCatalog(r.rows ?? []);
    });
  }

  const matches = useMemo(() => {
    if (!catalog) return [];
    const taken = new Set((draft ?? []).map((r) => r.product_id));
    const tokens = searchNormalize(search).split(" ").filter(Boolean);
    return catalog
      .filter((p) => !taken.has(p.product_id) && p.price > 0)
      .filter((p) => {
        if (tokens.length === 0) return true;
        const hay = searchNormalize(`${p.name} ${p.internal_code ?? ""} ${p.sku ?? ""}`);
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, 40);
  }, [catalog, draft, search]);

  const changes = (draft ?? []).filter((r) => r.qty !== r.was);
  const newSubtotal = (draft ?? []).reduce((s, r) => s + r.qty * r.unit_price, 0);
  const nothingLeft = editing && (draft ?? []).every((r) => r.qty === 0);

  function save() {
    if (changes.length === 0) return;
    if (nothingLeft) {
      toast.error("Дор хаяж нэг бараа үлдэх ёстой. Бүгдийг хасах бол захиалгыг цуцална уу.");
      return;
    }
    startSaving(async () => {
      const r = await correctOrderLines({
        orderId,
        changes: changes.map((c) => ({ product_id: c.product_id, qty: c.qty })),
        reason: reason.trim() || null,
        expectedUpdatedAt: updatedAt,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(r.changed === false ? "Өөрчлөлт алга" : "Захиалга засагдлаа");
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-2 sm:px-5">
        <h2 className="text-[15px] font-bold tracking-tight">Бараа</h2>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">
            {lines.length} төрөл · {lines.reduce((n, i) => n + Number(i.qty || 0), 0)} ширхэг
          </span>
          {!editing &&
            (lockedReason ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground" title={lockedReason}>
                <Lock className="h-3.5 w-3.5" />
                Засах боломжгүй
              </span>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Засах
              </Button>
            ))}
        </div>
      </div>

      {!editing && lockedReason && (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-[12px] text-muted-foreground sm:px-5">{lockedReason}</div>
      )}

      {/* Phones: one line per product, quantity controls on a row of their own —
          four columns don't fit 360px, and a table that scrolls sideways is no way to edit. */}
      <div className="sm:hidden">
        <ul className="divide-y divide-border">
          {!editing &&
            lines.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-snug">{item.name}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                    {item.qty} × {formatMnt(item.unit_price)}
                  </div>
                </div>
                <div className="shrink-0 text-[13.5px] font-bold tabular-nums">{formatMnt(item.line_total)}</div>
              </li>
            ))}

          {editing &&
            (draft ?? []).map((r) => {
              const off = r.qty === 0;
              return (
                <li key={r.product_id} className={cn("px-4 py-3", r.qty !== r.was && "bg-primary/5")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-[13px] font-semibold leading-snug", off && "line-through text-muted-foreground")}>
                        {r.name}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                        {formatMnt(r.unit_price)}
                        {r.was === 0 ? (
                          <span className="ml-1.5 font-semibold text-primary">· шинээр нэмсэн</span>
                        ) : r.qty !== r.was ? (
                          <span className="ml-1.5 font-semibold text-primary">
                            · {off ? "хасагдана" : `өмнө нь ${r.was}`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className={cn("shrink-0 text-[13.5px] font-bold tabular-nums", off && "text-muted-foreground")}>
                      {formatMnt(r.qty * r.unit_price)}
                    </div>
                  </div>
                  <div className="mt-2">
                    <QtyStepper row={r} onChange={setQty} disabled={saving} roomy />
                  </div>
                </li>
              );
            })}

          {editing &&
            gifts.map((g) => (
              <li key={g.id} className="flex items-start gap-3 px-4 py-3 text-muted-foreground">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-snug">{g.name}</div>
                  <div className="text-[11.5px]">{hasDeals ? "Бэлэг — хадгалахад дахин бодогдоно" : "Бэлэг"}</div>
                </div>
                <div className="shrink-0 text-[13.5px] font-semibold tabular-nums">{g.qty}ш</div>
              </li>
            ))}
        </ul>

        {!editing && (
          <div className="space-y-1.5 border-t border-border bg-muted/40 px-4 py-3 text-[13px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Дэд дүн</span>
              <span className="tabular-nums">{formatMnt(subtotal)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>
                  Хямдрал
                  {paymentMethod === "cash" && " · Бэлэн 2%"}
                </span>
                <span className="tabular-nums">−{formatMnt(discountTotal)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">
                Нийт төлөх
                {paymentMethod && (
                  <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-bold text-muted-foreground ring-1 ring-border">
                    {PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}
                  </span>
                )}
              </span>
              <span className="text-[16px] font-bold tabular-nums">{formatMnt(total)}</span>
            </div>
            {orderedTotal !== null && Math.round(orderedTotal) !== Math.round(total) && (
              <div className="flex justify-between text-[12px] text-muted-foreground">
                <span>Анх захиалсан дүн</span>
                <span className="tabular-nums line-through">{formatMnt(orderedTotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-[13px] [&_tbody_tr:nth-child(even)]:bg-muted/45">
          <thead className="bg-muted text-[11px] uppercase tracking-[0.08em] font-bold text-foreground/70">
            <tr>
              <th className="text-left px-5 py-2.5">Бараа</th>
              <th className={cn("px-3 py-2.5", editing ? "text-center w-44" : "text-right w-16")}>Тоо</th>
              <th className="text-right px-3 py-2.5 w-28">Үнэ</th>
              <th className="text-right px-5 py-2.5 w-32">Дүн</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!editing &&
              lines.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3">
                    <div className="text-[12.5px] font-semibold leading-snug">{item.name}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{item.qty}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatMnt(item.unit_price)}</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{formatMnt(item.line_total)}</td>
                </tr>
              ))}

            {editing &&
              (draft ?? []).map((r) => {
                const off = r.qty === 0;
                const isNew = r.was === 0;
                return (
                  <tr key={r.product_id} className={cn(r.qty !== r.was && "bg-primary/5!")}>
                    <td className="px-5 py-2.5">
                      <div className={cn("text-[12.5px] font-semibold leading-snug", off && "line-through text-muted-foreground")}>
                        {r.name}
                      </div>
                      {isNew ? (
                        <div className="text-[11px] font-semibold text-primary">Шинээр нэмсэн</div>
                      ) : r.qty !== r.was ? (
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {off ? "Хасагдана" : `Өмнө нь ${r.was} байсан`}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <QtyStepper row={r} onChange={setQty} disabled={saving} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatMnt(r.unit_price)}</td>
                    <td className={cn("px-5 py-2.5 text-right font-bold tabular-nums", off && "text-muted-foreground")}>
                      {formatMnt(r.qty * r.unit_price)}
                    </td>
                  </tr>
                );
              })}

            {editing &&
              gifts.map((g) => (
                <tr key={g.id} className="text-muted-foreground">
                  <td className="px-5 py-2.5">
                    <div className="text-[12.5px] leading-snug">{g.name}</div>
                    <div className="text-[11px]">{hasDeals ? "Бэлэг — хадгалахад дахин бодогдоно" : "Бэлэг"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{g.qty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMnt(0)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatMnt(0)}</td>
                </tr>
              ))}
          </tbody>

          {!editing && (
            <tfoot className="bg-muted/40">
              <tr>
                <td colSpan={3} className="px-5 py-2 text-right text-[12px] text-muted-foreground">
                  Дэд дүн
                </td>
                <td className="px-5 py-2 text-right text-[13px] tabular-nums text-muted-foreground">{formatMnt(subtotal)}</td>
              </tr>
              {discountTotal > 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-2 text-right text-[12px] text-emerald-700 dark:text-emerald-400">
                    Хямдрал
                    {paymentMethod === "cash" && " · Бэлэн 2%"}
                  </td>
                  <td className="px-5 py-2 text-right text-[13px] tabular-nums text-emerald-700 dark:text-emerald-400">
                    −{formatMnt(discountTotal)}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={3} className="px-5 py-3 text-right text-[12.5px] font-semibold">
                  Нийт төлөх
                  {paymentMethod && (
                    <span
                      className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ring-1 ${
                        paymentMethod === "cash"
                          ? "bg-emerald-100 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60"
                          : "bg-muted text-muted-foreground ring-border"
                      }`}
                    >
                      {PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-[15px] font-bold tabular-nums">{formatMnt(total)}</td>
              </tr>
              {orderedTotal !== null && Math.round(orderedTotal) !== Math.round(total) && (
                <tr>
                  <td colSpan={3} className="px-5 pb-3 text-right text-[12px] text-muted-foreground">
                    Анх захиалсан дүн
                  </td>
                  <td className="px-5 pb-3 text-right text-[12.5px] tabular-nums text-muted-foreground line-through">
                    {formatMnt(orderedTotal)}
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {editing && (
        <div className="border-t border-border">
          {/* Add a product from the store's price list. */}
          <div className="px-4 py-3 sm:px-5">
            {!picker ? (
              <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={saving}>
                <Plus className="h-3.5 w-3.5" />
                Бараа нэмэх
              </Button>
            ) : (
              <div className="rounded-xl ring-1 ring-border">
                <div className="flex items-center gap-2 border-b border-border p-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Нэмэх бараа хайх (нэр, код, баркод)"
                      className="h-9 pl-9"
                    />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPicker(false)}>
                    Хаах
                  </Button>
                </div>
                {loadingCatalog || !catalog ? (
                  <div className="flex items-center justify-center gap-2 p-6 text-[12.5px] text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Энэ дэлгүүрийн үнийг ачаалж байна...
                  </div>
                ) : matches.length === 0 ? (
                  <div className="p-6 text-center text-[12.5px] text-muted-foreground">Бараа олдсонгүй.</div>
                ) : (
                  <ul className="max-h-64 divide-y divide-border overflow-y-auto">
                    {matches.map((p) => (
                      <li key={p.product_id}>
                        <button
                          type="button"
                          className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/60"
                          onClick={() => {
                            setDraft((rows) => [
                              ...(rows ?? []),
                              { product_id: p.product_id, name: p.name, unit_price: p.price, was: 0, qty: 1 },
                            ]);
                            setSearch("");
                          }}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-medium leading-snug">{p.name}</span>
                            <span className="block text-[11px] text-muted-foreground tabular-nums">
                              {[p.internal_code, p.sku].filter(Boolean).join(" · ")}
                              {p.box_count && p.box_count > 1 ? ` · хайрцаг ${p.box_count}ш` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">{formatMnt(p.price)}</span>
                          <Plus className="h-4 w-4 shrink-0 text-primary" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Why — shown in the order's history. */}
          <div className="border-t border-border px-4 py-3 sm:px-5">
            <div className="mb-1.5 text-[12px] font-semibold">Шалтгаан</div>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="chip h-9 px-3"
                  data-active={reason === r || undefined}
                  onClick={() => setReason((cur) => (cur === r ? "" : r))}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Эсвэл өөрөө бичих (заавал биш)"
              maxLength={300}
              className="mt-2 h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/40 px-4 py-3 sm:px-5">
            <div className="mr-auto min-w-0">
              <div className="text-[11.5px] text-muted-foreground">
                {changes.length === 0 ? "Өөрчлөлт алга" : `${changes.length} бараа өөрчлөгдөнө`}
                {hasDeals && changes.length > 0 ? " · хөнгөлөлт, бэлгийг хадгалахад дахин бодно" : ""}
              </div>
              <div className="text-[15px] font-bold tabular-nums">
                {formatMnt(newSubtotal)}
                {Math.round(newSubtotal) !== Math.round(subtotal) && (
                  <span className="ml-2 text-[12.5px] font-normal text-muted-foreground line-through">{formatMnt(subtotal)}</span>
                )}
                <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">дэд дүн</span>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              Болих
            </Button>
            <Button type="button" onClick={save} disabled={saving || changes.length === 0 || nothingLeft}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Хадгалах
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
