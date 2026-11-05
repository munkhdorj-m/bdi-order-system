"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LayoutGrid,
  ListChecks,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/payment-method";
import { WEEKDAY_LABELS_MN, type Weekday } from "@/lib/delivery";
import { addDays, nextDateForWeekday } from "@/lib/dispatch";
import { formatMnt } from "@/lib/format";
import { searchNormalize } from "@/lib/translit";
import {
  CategoryIconTile,
  ProductPlaceholder,
  categoryVisual,
  type CategoryVisual,
} from "@/lib/category-visual";
import { cn } from "@/lib/utils";
import { fastScrollToElement } from "@/lib/scroll";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  createOrderForStore,
  loadStoreCatalog,
  type CatalogRow,
  type StoreSummary,
} from "@/app/admin/orders/new/actions";

export type StorePickOption = {
  id: string;
  name: string;
  address: string | null;
  registry_number: string | null;
  active: boolean;
};

export type OrderCategory = { id: string; name: string; icon: string | null };

type Section = { id: string; name: string; visual: CategoryVisual; rows: CatalogRow[] };

function sectionDomId(id: string) {
  return `oc-${id}`;
}

/** The admin header's height (h-14); the search bar sticks right under it. */
const HEADER_H = 56;

/**
 * Staff order entry: pick a store, type quantities, save. Products come
 * grouped by category (the same groups and order stores see), with a
 * category bar to jump between them. Built for entering many phone orders
 * in a row — "Хадгалаад дараагийнх" saves and clears the form, keeping the
 * delivery day and payment method.
 */
export function OrderCreateForm({
  stores,
  categories,
  today,
  initialStore,
  initialRows,
}: {
  stores: StorePickOption[];
  categories: OrderCategory[];
  today: string;
  initialStore: StoreSummary | null;
  initialRows: CatalogRow[];
}) {
  const router = useRouter();
  const [storeKey, setStoreKey] = useState(0); // remounts the picker on reset
  const [storeId, setStoreId] = useState(initialStore?.id ?? "");
  const [store, setStore] = useState<StoreSummary | null>(initialStore);
  const [rows, setRows] = useState<CatalogRow[]>(initialRows);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("credit");
  const [deliveryDate, setDeliveryDate] = useState(
    initialStore?.delivery_weekday
      ? nextDateForWeekday(today, initialStore.delivery_weekday)
      : addDays(today, 1),
  );
  const [notes, setNotes] = useState("");
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const barRef = useRef<HTMLDivElement>(null);

  const storeOptions = useMemo(
    () =>
      stores.map((s) => ({
        value: s.id,
        label: s.name,
        description:
          [s.registry_number && `РД ${s.registry_number}`, s.address, s.active ? null : "идэвхгүй"]
            .filter(Boolean)
            .join(" · ") || undefined,
      })),
    [stores],
  );

  function pickStore(id: string) {
    setStoreId(id);
    setQty({});
    setRows([]);
    setStore(null);
    if (!id) return;
    startLoading(async () => {
      const r = await loadStoreCatalog(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setRows(r.rows ?? []);
      setStore(r.store ?? null);
      if (r.store?.delivery_weekday) {
        setDeliveryDate(nextDateForWeekday(today, r.store.delivery_weekday));
      }
    });
  }

  const indexed = useMemo(
    () =>
      rows.map((r) => ({
        r,
        hay: searchNormalize(`${r.name} ${r.internal_code ?? ""} ${r.sku ?? ""}`),
      })),
    [rows],
  );
  const visible = useMemo(() => {
    const tokens = searchNormalize(search).split(" ").filter(Boolean);
    return indexed
      .filter(
        ({ r, hay }) =>
          (!onlyPicked || (qty[r.product_id] ?? 0) > 0) &&
          tokens.every((t) => hay.includes(t)),
      )
      .map((x) => x.r);
  }, [indexed, search, onlyPicked, qty]);

  // Visible rows grouped by category, in the catalog's category order.
  const sections = useMemo<Section[]>(() => {
    const known = new Set(categories.map((c) => c.id));
    const groups = new Map<string, CatalogRow[]>();
    for (const r of visible) {
      const key = r.category_id && known.has(r.category_id) ? r.category_id : "other";
      const list = groups.get(key);
      if (list) list.push(r);
      else groups.set(key, [r]);
    }
    const out: Section[] = categories
      .filter((c) => groups.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, visual: categoryVisual(c), rows: groups.get(c.id)! }));
    if (groups.has("other")) {
      out.push({ id: "other", name: "Бусад", visual: categoryVisual(null), rows: groups.get("other")! });
    }
    return out;
  }, [visible, categories]);

  const picked = rows.filter((r) => (qty[r.product_id] ?? 0) > 0);
  const pieces = picked.reduce((s, r) => s + qty[r.product_id], 0);
  const total = picked.reduce((s, r) => s + r.price * qty[r.product_id], 0);

  function pickedIn(section: Section) {
    return section.rows.filter((r) => (qty[r.product_id] ?? 0) > 0).length;
  }

  function setLine(id: string, n: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)) }));
  }

  // Height of the sticky search bar, so the category list can stick just
  // below it and jumps land just under it.
  const [barH, setBarH] = useState(60);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const ro = new ResizeObserver(() => setBarH(bar.offsetHeight));
    ro.observe(bar);
    return () => ro.disconnect();
  }, [storeId]);
  const stuckBottom = HEADER_H + barH;

  // Which category is on screen (highlighted in the list).
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const spyLocked = useRef(false);
  const sectionKey = sections.map((s) => s.id).join("|");
  useEffect(() => {
    const ids = sectionKey ? sectionKey.split("|") : [];
    let raf = 0;
    const measure = () => {
      raf = 0;
      if (spyLocked.current) return;
      const line = HEADER_H + (barRef.current?.offsetHeight ?? 60) + 12;
      let current: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(sectionDomId(id));
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sectionKey]);

  /** Quick scroll so the section starts right under the sticky search bar. */
  function jump(id: string) {
    const el = document.getElementById(sectionDomId(id));
    if (!el) return;
    setActiveSection(id);
    spyLocked.current = true;
    window.setTimeout(() => {
      spyLocked.current = false;
    }, 350);
    fastScrollToElement(el, HEADER_H + (barRef.current?.offsetHeight ?? barH));
  }

  function save(andNext: boolean) {
    if (!storeId) return toast.error("Дэлгүүр сонгоно уу.");
    if (picked.length === 0) return toast.error("Бараа нэмнэ үү.");
    startSaving(async () => {
      const r = await createOrderForStore({
        storeId,
        items: picked.map((p) => ({ product_id: p.product_id, qty: qty[p.product_id] })),
        paymentMethod: payment,
        deliveryDate,
        notes,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (andNext) {
        toast.success(`${r.orderNumber} хадгаллаа`, {
          description: store?.name,
          action: { label: "Нээх", onClick: () => router.push(`/admin/orders/${r.orderId}`) },
        });
        setStoreId("");
        setStore(null);
        setRows([]);
        setQty({});
        setNotes("");
        setSearch("");
        setOnlyPicked(false);
        setStoreKey((k) => k + 1);
      } else {
        toast.success(`${r.orderNumber} хадгаллаа`);
        router.push(`/admin/orders/${r.orderId}`);
      }
    });
  }

  return (
    <div className="space-y-4 pb-24">
      <Card className="p-4 space-y-3">
        <div>
          <Label className="mb-1.5 block">Дэлгүүр *</Label>
          <SearchableSelect
            key={storeKey}
            name="store_id"
            options={storeOptions}
            defaultValue={storeId}
            placeholder="Дэлгүүр сонгох"
            searchPlaceholder="Нэр, РД, хаягаар хайх..."
            emptyLabel="Дэлгүүр олдсонгүй"
            onValueChange={pickStore}
          />
        </div>
        {store && (
          <div className="grid gap-x-6 gap-y-1 text-[12.5px] text-muted-foreground sm:grid-cols-2">
            <div>
              Үнийн жагсаалт:{" "}
              <span className="font-semibold text-foreground">{store.price_list ?? "Үндсэн үнэ"}</span>
            </div>
            <div>
              Хуваарьт хүргэлт:{" "}
              <span className="font-semibold text-foreground">
                {store.delivery_weekday
                  ? WEEKDAY_LABELS_MN[store.delivery_weekday as Weekday]
                  : "тогтоогоогүй"}
              </span>
            </div>
            {store.registry_number && <div>РД: {store.registry_number}</div>}
            {store.contact_phone && <div>Утас: {store.contact_phone}</div>}
            {store.address && <div className="sm:col-span-2">{store.address}</div>}
          </div>
        )}
        <div className="grid gap-3 border-t pt-3 sm:grid-cols-[9rem_11rem_1fr]">
          <div>
            <Label className="mb-1 block text-[12px]">Төлбөр</Label>
            <Select value={payment} onValueChange={(v) => setPayment(v as PaymentMethod)}>
              <SelectTrigger size="default" className="h-9 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="delivery_date" className="mb-1 block text-[12px]">
              Хүргэх өдөр
            </Label>
            <Input
              id="delivery_date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="notes" className="mb-1 block text-[12px]">
              Тайлбар
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              className="min-h-9 py-1.5"
              placeholder="Заавал биш"
            />
          </div>
        </div>
      </Card>

      {storeId && (
        // overflow-clip (not hidden) so the category bar can stick to the page.
        <Card className="gap-0 overflow-clip p-0">
          <div
            ref={barRef}
            className="sticky top-14 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
          >
            <div className="flex flex-wrap items-center gap-2 p-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Бараа хайх (нэр, код, баркод)"
                  className="pl-9 pr-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Хайлт цэвэрлэх"
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {sections.length > 1 && (
                <CategoryPicker
                  sections={sections}
                  pickedIn={pickedIn}
                  onPick={jump}
                  className="lg:hidden"
                />
              )}
              <Button
                type="button"
                variant={onlyPicked ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyPicked((v) => !v)}
              >
                <ListChecks className="size-4" />
                Сонгосон ({picked.length})
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Үнэ ачаалж байна...
            </div>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Бараа олдсонгүй.</div>
          ) : (
            <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
              {/* Wide screens: every category at once, beside the list. */}
              <aside className="hidden border-r bg-muted/20 lg:block">
                <nav
                  aria-label="Ангилал"
                  className="sticky space-y-0.5 overflow-y-auto p-2"
                  style={{ top: stuckBottom, maxHeight: `calc(100vh - ${stuckBottom + 84}px)` }}
                >
                  {sections.map((s) => {
                    const n = pickedIn(s);
                    const isActive = s.id === activeSection;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => jump(s.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex h-9 w-full items-center gap-2 rounded-lg px-1.5 text-left text-[12.5px] transition-colors",
                          isActive ? "bg-card font-bold text-foreground shadow-sm ring-1 ring-border" : "text-foreground/80 hover:bg-muted",
                        )}
                      >
                        <CategoryIconTile visual={s.visual} size="xs" active={isActive} />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        {n > 0 ? (
                          <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[10.5px] font-bold leading-5 text-primary-foreground tabular-nums">
                            {n}
                          </span>
                        ) : (
                          <span className="text-[11px] tabular-nums text-muted-foreground">{s.rows.length}</span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </aside>
              <div className="min-w-0">
                {sections.map((s) => {
                  const n = pickedIn(s);
                  return (
                    <section key={s.id} id={sectionDomId(s.id)}>
                      <div className="flex items-center gap-2.5 border-b bg-muted/40 px-3 py-2">
                        <CategoryIconTile visual={s.visual} size="sm" />
                        <span className="text-[13.5px] font-bold">{s.name}</span>
                        <span className="text-[11.5px] text-muted-foreground">{s.rows.length} бараа</span>
                        {n > 0 && (
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {n} сонгосон
                          </span>
                        )}
                      </div>
                      <ul className="divide-y">
                        {s.rows.map((r) => (
                          <OrderLine
                            key={r.product_id}
                            r={r}
                            n={qty[r.product_id] ?? 0}
                            visual={s.visual}
                            setLine={setLine}
                          />
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      <p className="text-[11.5px] text-muted-foreground">
        Хадгалсан захиалга шууд &quot;Баталгаажсан&quot; болж{" "}
        <Link href="/admin/dispatch" className="underline underline-offset-2">
          Хүргэлт хуваарлах
        </Link>{" "}
        хуудсанд гарна.
      </p>

      {/* Slim sticky bar: total + save */}
      <div className="fixed bottom-0 inset-x-0 z-30 lg:left-60">
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <Card className="flex flex-row flex-wrap items-center gap-2 px-3 py-2 shadow-xl ring-1 ring-border">
            <div className="mr-auto min-w-0">
              <div className="text-[11px] text-muted-foreground">
                {picked.length} бараа · {pieces} ширхэг
              </div>
              <div className="text-[17px] font-bold tabular-nums leading-tight">{formatMnt(total)}</div>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => save(true)}>
              <Plus className="size-4" />
              Хадгалаад дараагийнх
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => save(false)}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Хадгалах
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Narrow screens: one button that opens every category as a grid. */
function CategoryPicker({
  sections,
  pickedIn,
  onPick,
  className,
}: {
  sections: Section[];
  pickedIn: (s: Section) => number;
  onPick: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={className}>
          <LayoutGrid className="size-4" />
          Ангилал
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-2">
        <div className="grid grid-cols-2 gap-1">
          {sections.map((s) => {
            const n = pickedIn(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(s.id);
                }}
                className="flex items-center gap-2 rounded-lg p-1.5 text-left text-[12.5px] font-medium hover:bg-muted"
              >
                <CategoryIconTile visual={s.visual} size="sm" />
                <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{s.name}</span>
                {n > 0 ? (
                  <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[10.5px] font-bold leading-5 text-primary-foreground tabular-nums">
                    {n}
                  </span>
                ) : (
                  <span className="text-[11px] tabular-nums text-muted-foreground">{s.rows.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OrderLine({
  r,
  n,
  visual,
  setLine,
}: {
  r: CatalogRow;
  n: number;
  visual: CategoryVisual;
  setLine: (id: string, n: number) => void;
}) {
  const box = r.box_count && r.box_count > 1 ? r.box_count : null;
  const boxes = box ? Math.floor(n / box) : 0;
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", n > 0 && "bg-primary/5")}>
      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border">
        {r.image_url ? (
          <Image src={r.image_url} alt="" fill sizes="44px" unoptimized className="object-cover" />
        ) : (
          <ProductPlaceholder visual={visual} size="sm" />
        )}
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <div className="text-[13.5px] font-medium leading-snug">{r.name}</div>
        <div className="text-[11.5px] text-muted-foreground tabular-nums">
          {[r.internal_code, r.sku].filter(Boolean).join(" · ")}
          {box ? ` · хайрцаг ${box}ш` : ""}
          {` · үлдэгдэл ${r.stock}`}
        </div>
      </div>
      <div className="w-24 text-right text-[13px] font-semibold tabular-nums">
        {formatMnt(r.price)}
        {r.price_source === "base" && (
          <div className="text-[10px] font-normal text-muted-foreground">үндсэн үнэ</div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setLine(r.product_id, n - 1)}
          disabled={n <= 0}
          aria-label="Хасах"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={n || ""}
          placeholder="0"
          onChange={(e) => setLine(r.product_id, Number(e.target.value))}
          className="h-8 w-20 text-center tabular-nums"
          aria-label={`${r.name} тоо`}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setLine(r.product_id, n + 1)}
          aria-label="Нэмэх"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        {box ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setLine(r.product_id, n + box)}
            title={`Нэг хайрцаг (${box}ш) нэмэх`}
          >
            <PackagePlus className="size-4" />
            {box}
          </Button>
        ) : null}
      </div>
      <div className="w-24 text-right text-[13px] tabular-nums">
        {n > 0 ? (
          <>
            <div className="text-foreground">{formatMnt(n * r.price)}</div>
            {boxes > 0 && (
              <div className="text-[10.5px] text-primary">
                {boxes} хайрцаг{n % box! > 0 ? ` + ${n % box!}ш` : ""}
              </div>
            )}
          </>
        ) : (
          ""
        )}
      </div>
    </li>
  );
}
