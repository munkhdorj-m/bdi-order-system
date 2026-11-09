"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActiveSwitch } from "@/components/ui/active-switch";
import { cleanRegistry } from "@/lib/ebarimt";

export type SupermarketFormDefaults = {
  id?: string;
  name?: string;
  type?: string | null;
  district?: string | null;
  address?: string | null;
  contact_phone?: string | null;
  assigned_rep_id?: string | null;
  price_list_id?: string | null;
  /** ISO weekday 1-7 (Mon-Sun). null/undefined → use district default. */
  delivery_day?: number | null;
  notes?: string | null;
  active?: boolean;
  registry_number?: string | null;
  ebarimt_tin?: string | null;
  ebarimt_name?: string | null;
  external_id?: string | null;
};

export type RepOption = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export type PriceListOption = {
  id: string;
  name: string;
  /** Archived — kept in the picker only because this store still uses it. */
  archived?: boolean;
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

// District names — single-spaced so they match the delivery-day map in
// lib/delivery.ts. The normalizer in lib/delivery.ts also collapses
// whitespace defensively, but storing clean strings keeps DB queries
// predictable.
const DEFAULT_DISTRICTS = [
  "Баянгол Дүүрэг",
  "Баянзүрх Дүүрэг",
  "Чингэлтэй Дүүрэг",
  "Хан-Уул Дүүрэг",
  "Сонгино Хайрхан Дүүрэг",
  "Сүхбаатар Дүүрэг",
  "Налайх Дүүрэг",
  "Багануур Дүүрэг",
  "Багахангай Дүүрэг",
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

  // Radix Select disallows "" as an item value. Mirror the chosen
  // assigned_rep_id / price_list_id through hidden inputs so we can still
  // submit "" when the user picks the "— none —" option.
  const [assignedRepId, setAssignedRepId] = useState<string>(
    defaults.assigned_rep_id ?? "",
  );
  const [priceListId, setPriceListId] = useState<string>(
    defaults.price_list_id ?? "",
  );
  const [deliveryDay, setDeliveryDay] = useState<string>(
    defaults.delivery_day != null ? String(defaults.delivery_day) : "",
  );
  const [registry, setRegistry] = useState(defaults.registry_number ?? "");
  const [tin, setTin] = useState(defaults.ebarimt_tin ?? "");
  // B2B (company) receipt only with a valid РД or ТТД; otherwise e-Barimt
  // goes out as a consumer receipt — say so while the admin types.
  const b2b = Boolean(cleanRegistry(registry) || cleanRegistry(tin));
  const registryLooksWrong = registry.trim() !== "" && !cleanRegistry(registry);

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

          {/* Delivery-day override. Empty (default) = "use district default"
              resolved by lib/delivery.ts. */}
          <Field label="Хүргэлтийн өдөр" htmlFor="delivery_day">
            <input
              type="hidden"
              name="delivery_day"
              value={deliveryDay}
            />
            <Select
              value={deliveryDay || "__default"}
              onValueChange={(v) =>
                setDeliveryDay(v === "__default" ? "" : v)
              }
            >
              <SelectTrigger
                id="delivery_day"
                className="w-full h-10 rounded-xl"
              >
                <SelectValue placeholder="Дүүргийн өгөгдмөл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default">Дүүргийн өгөгдмөл</SelectItem>
                <SelectItem value="1">Даваа</SelectItem>
                <SelectItem value="2">Мягмар</SelectItem>
                <SelectItem value="3">Лхагва</SelectItem>
                <SelectItem value="4">Пүрэв</SelectItem>
                <SelectItem value="5">Баасан</SelectItem>
                <SelectItem value="6">Бямба</SelectItem>
                <SelectItem value="7">Ням</SelectItem>
              </SelectContent>
            </Select>
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
            <input
              type="hidden"
              name="assigned_rep_id"
              value={assignedRepId}
            />
            <Select
              value={assignedRepId || "__none"}
              onValueChange={(v) =>
                setAssignedRepId(v === "__none" ? "" : v)
              }
            >
              <SelectTrigger id="assigned_rep_id" className="w-full h-10 rounded-xl">
                <SelectValue placeholder="— Хариуцагчгүй —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Хариуцагчгүй —</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.full_name || r.phone || r.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Үнийн жагсаалт"
            htmlFor="price_list_id"
            className="md:col-span-2"
          >
            <input type="hidden" name="price_list_id" value={priceListId} />
            <Select
              value={priceListId || "__none"}
              onValueChange={(v) =>
                setPriceListId(v === "__none" ? "" : v)
              }
            >
              <SelectTrigger id="price_list_id" className="w-full h-10 rounded-xl">
                <SelectValue placeholder="— Жишиг үнэ ашиглах —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Жишиг үнэ ашиглах —</SelectItem>
                {priceLists.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id}>
                    {pl.name}
                    {pl.archived ? " (архивласан)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* Tax + Mercury ids: e-Barimt bills the store as a company only with
          a valid РД / ТТД, and the Mercury code ties it to the ERP. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Татвар ба Mercury</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Регистрийн дугаар (РД)" htmlFor="registry_number">
            <Input
              id="registry_number"
              name="registry_number"
              value={registry}
              onChange={(e) => setRegistry(e.target.value)}
              placeholder="1234567 эсвэл УБ12345678"
              autoComplete="off"
            />
            {registryLooksWrong && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                РД буруу хэлбэртэй — 7 оронтой (компани) эсвэл 2 үсэг + 8 орон.
              </p>
            )}
          </Field>
          <Field label="ТТД (е-баримт)" htmlFor="ebarimt_tin">
            <Input
              id="ebarimt_tin"
              name="ebarimt_tin"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              placeholder="Хоосон бол РД-ээр автоматаар олно"
              autoComplete="off"
            />
          </Field>
          <Field label="Е-баримт дээрх нэр" htmlFor="ebarimt_name">
            <Input
              id="ebarimt_name"
              name="ebarimt_name"
              defaultValue={defaults.ebarimt_name ?? ""}
              placeholder="Татварын бүртгэлийн нэр"
            />
          </Field>
          <Field label="Mercury код" htmlFor="external_id">
            <Input
              id="external_id"
              name="external_id"
              defaultValue={defaults.external_id ?? ""}
              placeholder="Харилцагчийн код"
              autoComplete="off"
            />
          </Field>
          <p className="md:col-span-2 text-xs text-muted-foreground -mt-1">
            {b2b
              ? "Е-баримт байгууллагын (B2B) баримтаар гарна."
              : "РД / ТТД байхгүй бол е-баримт хувь хүний (B2C) баримтаар гарна."}{" "}
            РД солиход хуучин ТТД-г арилгаж, шинээр хайлгана.
          </p>
        </CardContent>
      </Card>

      <ActiveSwitch
        defaultChecked={defaults.active ?? true}
        activeHint="Худалдан авагч/төлөөлөгч энэ дэлгүүрт захиалга үүсгэх боломжтой."
        inactiveHint="Дэлгүүр түр хаалттай — захиалга үүсгэх боломжгүй."
      />

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
