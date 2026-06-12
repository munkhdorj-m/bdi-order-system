"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Check,
  Gift,
  ListChecks,
  ListX,
  Percent,
  Power,
  Sparkles,
  Store,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select";
import { ActiveSwitch } from "@/components/ui/active-switch";

type ActionState = { error?: string };

type DiscountKind = "product" | "threshold_bonus";
type TargetMode = "all" | "include" | "exclude";

export type DiscountFormDefaults = {
  id?: string;
  name?: string;
  kind?: DiscountKind;
  pct?: number | null;
  step_amount?: number | null;
  step_qty?: number | null;
  bonus_n?: number | null;
  product_id?: string | null;
  category_id?: string | null;
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  notes?: string | null;
  target_mode?: TargetMode | string | null;
  target_price_list_ids?: string[] | null;
};

export type ProductOption = { id: string; name: string; sku: string };
export type CategoryOption = { id: string; name: string };
export type PriceListOption = {
  id: string;
  name: string;
  /** How many stores point at this list — shown so the admin knows the
   *  blast radius of including/excluding it. */
  storeCount: number;
};

type Props = {
  defaults?: DiscountFormDefaults;
  products: ProductOption[];
  categories: CategoryOption[];
  priceLists: PriceListOption[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
};

/**
 * Datetime-local input needs a "yyyy-MM-ddTHH:mm" string in local time.
 * The DB stores ISO UTC, so we slice off the seconds + Z.
 */
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DiscountForm({
  defaults = {},
  products,
  categories,
  priceLists,
  action,
  submitLabel,
}: Props) {
  const [kind, setKind] = useState<DiscountKind>(defaults.kind ?? "product");
  const defaultMode: TargetMode =
    defaults.target_mode === "include" || defaults.target_mode === "exclude"
      ? defaults.target_mode
      : "all";
  const [targetMode, setTargetMode] = useState<TargetMode>(defaultMode);
  const [selectedLists, setSelectedLists] = useState<Set<string>>(
    () => new Set(defaults.target_price_list_ids ?? []),
  );
  const [state, formAction, pending] = useActionState(action, {});

  function toggleList(id: string) {
    setSelectedLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Live summary so the admin sees the blast radius before saving.
  const selectedStoreCount = priceLists
    .filter((p) => selectedLists.has(p.id))
    .reduce((sum, p) => sum + p.storeCount, 0);

  const productOptions: SelectOption[] = products.map((p) => ({
    value: p.id,
    label: p.name,
    description: p.sku,
  }));
  const categoryOptions: SelectOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <form action={formAction} className="space-y-5 max-w-3xl">
      {state?.error && (
        <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Section 1 — basics */}
      <Section
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Үндсэн мэдээлэл"
        subtitle="Хямдралын нэр болон төрөл"
      >
        <Field label="Нэр" htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={defaults.name ?? ""}
            required
            placeholder="Жш: 11/11 Хямдрал"
            className="h-11 text-[14px] rounded-xl"
          />
        </Field>

        <Field label="Төрөл">
          <input type="hidden" name="kind" value={kind} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <KindCard
              active={kind === "product"}
              icon={<Tag className="h-4 w-4" />}
              label="Бараа дээр"
              hint="Тодорхой бараа / ангилалын % хямдрал"
              onClick={() => setKind("product")}
            />
            <KindCard
              active={kind === "threshold_bonus"}
              icon={<Gift className="h-4 w-4" />}
              label="Босгоор бэлэг"
              hint="Тодорхой дүнгээс дээш захиалбал бэлэг бараа"
              onClick={() => setKind("threshold_bonus")}
            />
          </div>
        </Field>
      </Section>

      {/* Section 2 — kind-specific payload */}
      <Section
        icon={
          kind === "product" ? (
            <Percent className="h-3.5 w-3.5" />
          ) : (
            <Gift className="h-3.5 w-3.5" />
          )
        }
        title={kind === "product" ? "Хямдралын хувь" : "Босго ба бэлэг"}
        subtitle={
          kind === "product"
            ? "Хэдэн хувиар, ямар бараан дээр"
            : "Ямар дүнгээс дээш авбал, ямар бэлэг өгөх"
        }
      >
        {kind === "product" ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Хямдрал (%)" htmlFor="pct">
                <div className="relative">
                  <Input
                    id="pct"
                    name="pct"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={defaults.pct ?? ""}
                    required
                    placeholder="10"
                    className="h-11 text-[15px] font-semibold rounded-xl pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold pointer-events-none">
                    %
                  </span>
                </div>
              </Field>
              <Field label="Бараа (нэг)">
                <SearchableSelect
                  name="product_id"
                  options={productOptions}
                  defaultValue={defaults.product_id ?? ""}
                  placeholder="— Сонгох —"
                  searchPlaceholder="Бараа хайх..."
                  emptyLabel="Бараа олдсонгүй"
                  allowEmpty
                  emptyOptionLabel="— Сонгохгүй —"
                  className="h-11 rounded-xl"
                />
              </Field>
            </div>
            <Field label="эсвэл Ангилал (бүгд дээр)">
              <SearchableSelect
                name="category_id"
                options={categoryOptions}
                defaultValue={defaults.category_id ?? ""}
                placeholder="— Сонгох —"
                searchPlaceholder="Ангилал хайх..."
                emptyLabel="Ангилал олдсонгүй"
                allowEmpty
                emptyOptionLabel="— Сонгохгүй —"
                className="h-11 rounded-xl"
              />
              <p className="text-[11.5px] text-muted-foreground mt-1.5">
                Хоёрыг хоосон үлдээвэл бүх бараанд хамаарна.
              </p>
            </Field>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Босго дүн (₮)" htmlFor="step_amount">
                <div className="relative">
                  <Input
                    id="step_amount"
                    name="step_amount"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={defaults.step_amount ?? ""}
                    placeholder="100000"
                    required
                    className="h-11 text-[15px] font-semibold rounded-xl pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold pointer-events-none">
                    ₮
                  </span>
                </div>
              </Field>
              <Field label="Бэлэг ширхэг" htmlFor="bonus_n">
                <Input
                  id="bonus_n"
                  name="bonus_n"
                  type="number"
                  step="1"
                  min="1"
                  defaultValue={defaults.bonus_n ?? ""}
                  placeholder="1"
                  required
                  className="h-11 text-[15px] font-semibold rounded-xl"
                />
              </Field>
            </div>
            <Field label="Бэлэг өгөх бараа">
              <SearchableSelect
                name="product_id"
                options={productOptions}
                defaultValue={defaults.product_id ?? ""}
                placeholder="— Сонгох —"
                searchPlaceholder="Бараа хайх..."
                emptyLabel="Бараа олдсонгүй"
                className="h-11 rounded-xl"
              />
              <p className="text-[11.5px] text-muted-foreground mt-1.5">
                Жш: 100,000₮-аас дээш захиалбал сонгосон 1 ширхэг бараа бэлэг.
              </p>
            </Field>
          </>
        )}
      </Section>

      {/* Section 3 — store scope. Targeting works through PRICE LISTS
          because chains already map to one list each ("BSB сүлжээ",
          "Ази Фарма"...) — picking a list = picking the whole chain in
          one tap. */}
      <Section
        icon={<Store className="h-3.5 w-3.5" />}
        title="Хамрах дэлгүүр"
        subtitle="Аль дэлгүүрүүдэд энэ хямдрал үйлчлэх вэ"
      >
        <input type="hidden" name="target_mode" value={targetMode} />
        {targetMode !== "all" &&
          [...selectedLists].map((id) => (
            <input
              key={id}
              type="hidden"
              name="target_price_list_ids"
              value={id}
            />
          ))}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <KindCard
            active={targetMode === "all"}
            icon={<Store className="h-4 w-4" />}
            label="Бүх дэлгүүр"
            hint="Хязгааргүй — бүгдэд үйлчилнэ"
            onClick={() => setTargetMode("all")}
          />
          <KindCard
            active={targetMode === "include"}
            icon={<ListChecks className="h-4 w-4" />}
            label="Зөвхөн сонгосон"
            hint="Сонгосон жагсаалтын дэлгүүрүүдэд л"
            onClick={() => setTargetMode("include")}
          />
          <KindCard
            active={targetMode === "exclude"}
            icon={<ListX className="h-4 w-4" />}
            label="Сонгосноос бусад"
            hint="Сонгосон жагсаалтыг хасаад бусдад нь"
            onClick={() => setTargetMode("exclude")}
          />
        </div>

        {targetMode !== "all" && (
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <Label className="text-[11.5px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                Үнийн жагсаалт сонгох
              </Label>
              {selectedLists.size > 0 && (
                <span className="text-[11.5px] font-semibold text-primary tabular-nums">
                  {selectedLists.size} жагсаалт · {selectedStoreCount} дэлгүүр
                  {targetMode === "exclude" ? " хасагдана" : ""}
                </span>
              )}
            </div>

            {priceLists.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground rounded-xl bg-muted/50 px-3 py-2.5">
                Үнийн жагсаалт алга байна. Эхлээд «Үнийн жагсаалт» хэсэгт
                жагсаалт үүсгэж дэлгүүрүүдээ оноогоорой.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {priceLists.map((pl) => {
                  const checked = selectedLists.has(pl.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => toggleList(pl.id)}
                      aria-pressed={checked}
                      className={`flex items-center gap-2.5 text-left rounded-xl ring-1 px-3 py-2.5 transition-all ${
                        checked
                          ? "ring-primary bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))]"
                          : "ring-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <span
                        className={`size-5 shrink-0 rounded-md flex items-center justify-center ring-1 transition-colors ${
                          checked
                            ? "bg-primary ring-primary text-primary-foreground"
                            : "ring-border bg-card"
                        }`}
                      >
                        {checked && (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        )}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block text-[13px] font-semibold truncate">
                          {pl.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {pl.storeCount} дэлгүүр
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-[11.5px] text-muted-foreground mt-2">
              Үнийн жагсаалтгүй дэлгүүрүүд: «Зөвхөн сонгосон» горимд
              хамаарахгүй, «Сонгосноос бусад» горимд хамаарна.
            </p>
          </div>
        )}
      </Section>

      {/* Section 4 — schedule */}
      <Section
        icon={<Calendar className="h-3.5 w-3.5" />}
        title="Хугацаа"
        subtitle="Хямдрал ажиллах хугацаа (заавал биш)"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Эхлэх" htmlFor="starts_at">
            <DateTimeInput
              id="starts_at"
              name="starts_at"
              defaultValue={isoToLocalInput(defaults.starts_at)}
            />
          </Field>
          <Field label="Дуусах" htmlFor="ends_at">
            <DateTimeInput
              id="ends_at"
              name="ends_at"
              defaultValue={isoToLocalInput(defaults.ends_at)}
            />
          </Field>
        </div>
        <p className="text-[11.5px] text-muted-foreground -mt-1.5">
          Хоосон үлдээвэл хязгааргүй ажиллана.
        </p>
      </Section>

      {/* Section 4 — meta */}
      <Section
        icon={<Power className="h-3.5 w-3.5" />}
        title="Тохиргоо"
        subtitle="Тэмдэглэл болон идэвхтэй эсэх"
      >
        <Field label="Тэмдэглэл (заавал биш)" htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={defaults.notes ?? ""}
            placeholder="Дотоод тэмдэглэл, кампанит ажилтай холбоотой жижиг сэрэмжлүүлэг..."
            className="rounded-xl text-[13.5px] leading-relaxed"
          />
        </Field>

        {/* Active toggle — uses the shared ActiveSwitch component so the
            geometry / hover state / dark-mode treatment is identical to
            the product / supermarket / user / price-list forms. */}
        <ActiveSwitch
          defaultChecked={defaults.active ?? true}
          activeHint="Худалдан авагчид одоо харагдаж байна."
          inactiveHint="Хадгалсан ч худалдан авагчид харагдахгүй."
        />
      </Section>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={pending}
          size="lg"
          className="rounded-xl px-6"
        >
          {pending ? "Хадгалж байна..." : submitLabel}
        </Button>
        <Button asChild variant="ghost" size="lg" className="rounded-xl">
          <Link href="/admin/discounts">Цуцлах</Link>
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Section wrapper — card with icon header + subtle subline. Groups
// related fields visually so the form doesn't feel like a flat list.
// ---------------------------------------------------------------------

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card ring-1 ring-border p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="size-8 rounded-xl bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 leading-tight">
          <h3 className="text-[14.5px] font-bold tracking-tight">{title}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Field wrapper — label + control with consistent spacing.
// ---------------------------------------------------------------------

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label
        htmlFor={htmlFor}
        className="text-[11.5px] uppercase tracking-[0.08em] font-bold text-muted-foreground mb-1.5"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------
// KindCard — visually-prominent toggle for the two discount kinds.
// ---------------------------------------------------------------------

function KindCard({
  active,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-2xl ring-1 p-3.5 transition-all ${
        active
          ? "ring-primary bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] shadow-sm"
          : "ring-border bg-card hover:bg-muted/40 hover:ring-border/80"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`size-8 rounded-xl flex items-center justify-center transition-colors ${
            active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
        <div className="text-[13.5px] font-bold">{label}</div>
      </div>
      <div className="text-[11.5px] text-muted-foreground leading-snug mt-1.5">
        {hint}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------
// DateTimeInput — wraps native datetime-local in a styled container
// with a calendar icon so the empty "mm/dd/yyyy" placeholder reads as
// a real form field rather than browser chrome. `color-scheme` matches
// the user's theme so the native picker isn't blindingly white in
// dark mode.
// ---------------------------------------------------------------------

function DateTimeInput({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div className="relative">
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        id={id}
        name={name}
        type="datetime-local"
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border border-input bg-transparent pl-9 pr-3 text-[13.5px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30 [color-scheme:light] dark:[color-scheme:dark]"
      />
    </div>
  );
}
