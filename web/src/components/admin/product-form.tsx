"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
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

export type ProductFormDefaults = {
  id?: string;
  sku?: string;
  name?: string;
  category_id?: string | null;
  brand?: string | null;
  description?: string | null;
  unit?: string | null;
  pack_size?: number | null;
  box_count?: number | null;
  base_price?: number;
  cash_price?: number | null;
  stock?: number;
  image_url?: string | null;
  active?: boolean;
};

export type CategoryOption = {
  id: string;
  name: string;
};

type ActionState = { error?: string };

type Props = {
  categories: CategoryOption[];
  defaults?: ProductFormDefaults;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
};

/**
 * Admin product edit form laid out per the Hi-Fi AdminProductEdit pattern:
 * 3-col CSS Grid on md+ screens — image rail on the left, then two stacked
 * info cards on the right (basic info + price-and-stock). Mobile collapses
 * to a single column stack. Form action contract is unchanged.
 */
export function ProductForm({
  categories,
  defaults = {},
  action,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    defaults.image_url ?? null,
  );
  const [categoryId, setCategoryId] = useState<string>(
    defaults.category_id ?? "",
  );

  return (
    <form action={formAction} className="max-w-5xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ── Column 1 — Image ─────────────────────────────────────────── */}
        <Card className="md:col-span-1 self-start">
          <CardHeader>
            <CardTitle className="text-base">Зураг</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="aspect-square rounded-2xl ring-1 ring-border overflow-hidden relative bg-muted/40">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 320px"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 text-[12px]">
                  Зураг алга
                </div>
              )}
            </div>

            {/* Custom file picker so we can style it like the Hi-Fi dashed
                drop-zone. The underlying Input still posts as name="image". */}
            <label className="block">
              <Input
                type="file"
                name="image"
                accept="image/*"
                className="sr-only peer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPreviewUrl(URL.createObjectURL(file));
                }}
              />
              <span className="w-full h-10 rounded-xl border-2 border-dashed border-border bg-muted/30 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-1.5 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                <Upload className="h-3.5 w-3.5" strokeWidth={2.2} />
                Зураг сонгох
              </span>
            </label>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              JPG/PNG/WebP, дээд тал нь 5MB. Чанартай харагдахын тулд
              ~800–1200 пикселийн өргөнтэй, 500KB орчим зураг ачаалбал тохиромжтой.
              Хоосон үлдээвэл одоогийн зураг хадгалагдана.
            </p>
          </CardContent>
        </Card>

        {/* ── Columns 2-3 — Info cards stacked ─────────────────────────── */}
        <div className="md:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Үндсэн мэдээлэл</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Барааны нэр *"
                htmlFor="name"
                className="md:col-span-2"
              >
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={defaults.name ?? ""}
                  placeholder="жишээ нь: Soft Leaf салфетка 10ш"
                />
              </Field>

              <Field label="SKU / Бар код *" htmlFor="sku">
                <Input
                  id="sku"
                  name="sku"
                  required
                  defaultValue={defaults.sku ?? ""}
                  placeholder="4890326012629"
                />
              </Field>

              <Field label="Бренд" htmlFor="brand">
                <Input
                  id="brand"
                  name="brand"
                  defaultValue={defaults.brand ?? ""}
                  placeholder="Soft Leaf"
                />
              </Field>

              <Field
                label="Ангилал"
                htmlFor="category_id"
                className="md:col-span-2"
              >
                {/* Radix Select forbids "" as an item value, so we mirror the
                    chosen id through a hidden input and use "__none" as a
                    sentinel that the onValueChange handler converts back. */}
                <input type="hidden" name="category_id" value={categoryId} />
                <Select
                  value={categoryId || "__none"}
                  onValueChange={(v) =>
                    setCategoryId(v === "__none" ? "" : v)
                  }
                >
                  <SelectTrigger id="category_id" className="w-full h-10 rounded-xl">
                    <SelectValue placeholder="— Сонгох —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Сонгохгүй —</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Тайлбар"
                htmlFor="description"
                className="md:col-span-2"
              >
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  defaultValue={defaults.description ?? ""}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Үнэ ба нөөц</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field
                label="Бөөний үнэ * (₮)"
                htmlFor="base_price"
                className="md:col-span-1"
              >
                <Input
                  id="base_price"
                  name="base_price"
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={defaults.base_price ?? ""}
                />
              </Field>
              <Field
                label="Бэлэн мөнгөний үнэ (₮)"
                htmlFor="cash_price"
                help="Зөвхөн дотоод. Худалдан авагчид харагдахгүй."
              >
                <Input
                  id="cash_price"
                  name="cash_price"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={defaults.cash_price ?? ""}
                />
              </Field>
              <Field label="Үлдэгдэл" htmlFor="stock">
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  min={0}
                  defaultValue={defaults.stock ?? 0}
                />
              </Field>
              <Field label="Хэмжих нэгж" htmlFor="unit">
                <Input
                  id="unit"
                  name="unit"
                  defaultValue={defaults.unit ?? ""}
                  placeholder="уут / хайрцаг / ш"
                />
              </Field>
              <Field label="Багц дахь ш" htmlFor="pack_size">
                <Input
                  id="pack_size"
                  name="pack_size"
                  type="number"
                  min={0}
                  defaultValue={defaults.pack_size ?? ""}
                />
              </Field>
              <Field label="Хайрцаган дахь ш" htmlFor="box_count">
                <Input
                  id="box_count"
                  name="box_count"
                  type="number"
                  min={0}
                  defaultValue={defaults.box_count ?? ""}
                />
              </Field>
            </CardContent>
          </Card>

          <ActiveSwitch
            defaultChecked={defaults.active ?? true}
            activeHint="Худалдан авагчид каталогт харагдана."
            inactiveHint="Каталогт болон хайлтанд харагдахгүй."
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {state.error}
        </div>
      )}

      <div className="flex justify-end gap-3 sticky bottom-4">
        <Button asChild variant="outline">
          <Link href="/admin/products">Цуцлах</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Хадгалж байна..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
  help,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
  help?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block">
        {label}
      </Label>
      {children}
      {help && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
    </div>
  );
}
