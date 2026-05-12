"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SupermarketFormDefaults = {
  id?: string;
  name?: string;
  type?: string | null;
  district?: string | null;
  address?: string | null;
  contact_phone?: string | null;
  assigned_rep_id?: string | null;
  price_list_id?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type RepOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type PriceListOption = {
  id: string;
  name: string;
};

type ActionState = { error?: string };

type Props = {
  reps: RepOption[];
  priceLists?: PriceListOption[];
  defaults?: SupermarketFormDefaults;
  /** Distinct values from the DB, used as autocomplete suggestions. */
  typeSuggestions?: string[];
  districtSuggestions?: string[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
};

// Sensible defaults if the parent doesn't pass anything from DB.
const DEFAULT_TYPES = [
  "Супермаркет",
  "Сүлжээ",
  "Мини маркет",
  "Хүнсний",
  "Зах",
  "Байгууллага",
  "Бөөний төв",
  "Хувь хүн",
];

const DEFAULT_DISTRICTS = [
  "Баянгол  Дүүрэг",
  "Баянзүрх  Дүүрэг",
  "Чингэлтэй  Дүүрэг",
  "Хан-Уул  Дүүрэг",
  "Сонгино  Хайрхан Дүүрэг",
  "Сүхбаатар  Дүүрэг",
  "Налайх  Дүүрэг",
  "Багануур  Дүүрэг",
  "Багахангай  Дүүрэг",
];

export function SupermarketForm({
  reps,
  priceLists = [],
  defaults = {},
  typeSuggestions,
  districtSuggestions,
  action,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  const typeOptions = mergeSuggestions(typeSuggestions, DEFAULT_TYPES);
  const districtOptions = mergeSuggestions(districtSuggestions, DEFAULT_DISTRICTS);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Дэлгүүрийн мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Нэр *" htmlFor="name" className="md:col-span-2">
            <Input
              id="name"
              name="name"
              required
              defaultValue={defaults.name ?? ""}
              placeholder="Жишээ нь: Хүнс-Мини дэлгүүр"
            />
          </Field>

          <Field label="Төрөл" htmlFor="type">
            <Input
              id="type"
              name="type"
              list="supermarket-type-options"
              defaultValue={defaults.type ?? ""}
              placeholder="Супермаркет / Мини маркет ..."
            />
            <datalist id="supermarket-type-options">
              {typeOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>

          <Field label="Дүүрэг" htmlFor="district">
            <Input
              id="district"
              name="district"
              list="supermarket-district-options"
              defaultValue={defaults.district ?? ""}
              placeholder="Жишээ нь: Баянзүрх Дүүрэг"
            />
            <datalist id="supermarket-district-options">
              {districtOptions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>

          <Field label="Хаяг" htmlFor="address" className="md:col-span-2">
            <Textarea
              id="address"
              name="address"
              rows={2}
              defaultValue={defaults.address ?? ""}
            />
          </Field>

          <Field label="Холбоо барих утас" htmlFor="contact_phone">
            <Input
              id="contact_phone"
              name="contact_phone"
              defaultValue={defaults.contact_phone ?? ""}
              placeholder="+976 ..."
            />
          </Field>

          <Field label="Хариуцагч төлөөлөгч" htmlFor="assigned_rep_id">
            <select
              id="assigned_rep_id"
              name="assigned_rep_id"
              defaultValue={defaults.assigned_rep_id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">— Хариуцагчгүй —</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name || r.email || r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Үнийн жагсаалт"
            htmlFor="price_list_id"
            className="md:col-span-2"
          >
            <select
              id="price_list_id"
              name="price_list_id"
              defaultValue={defaults.price_list_id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">— Жишиг үнэ ашиглах —</option>
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Дэлгүүрт онцгой үнэ оноож амжаагүй бол энэ жагсаалтын үнэ ашиглагдана.
            </p>
          </Field>

          <Field label="Тэмдэглэл" htmlFor="notes" className="md:col-span-2">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={defaults.notes ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <input
            id="active"
            name="active"
            type="checkbox"
            defaultChecked={defaults.active ?? true}
            className="size-4 rounded border-input"
          />
          <Label htmlFor="active" className="font-normal">
            Идэвхтэй
          </Label>
        </CardContent>
      </Card>

      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {state.error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button asChild variant="outline">
          <Link href="/admin/supermarkets">Цуцлах</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Хадгалж байна..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function mergeSuggestions(
  fromDb: string[] | undefined,
  defaults: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...(fromDb ?? []), ...defaults]) {
    const trimmed = v?.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block">
        {label}
      </Label>
      {children}
    </div>
  );
}
