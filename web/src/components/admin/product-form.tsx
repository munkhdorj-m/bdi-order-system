"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Үндсэн мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Барааны нэр *" htmlFor="name" className="md:col-span-2">
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

          <Field label="Ангилал" htmlFor="category_id" className="md:col-span-2">
            <select
              id="category_id"
              name="category_id"
              defaultValue={defaults.category_id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">— Сонгох —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Тайлбар" htmlFor="description" className="md:col-span-2">
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
          <CardTitle className="text-base">Савлагаа & үлдэгдэл</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Хэмжих нэгж" htmlFor="unit">
            <Input
              id="unit"
              name="unit"
              defaultValue={defaults.unit ?? ""}
              placeholder="уут / хайрцаг / ш"
            />
          </Field>
          <Field label="Багц дахь ширхэг" htmlFor="pack_size">
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
          <Field label="Үлдэгдэл" htmlFor="stock">
            <Input
              id="stock"
              name="stock"
              type="number"
              min={0}
              defaultValue={defaults.stock ?? 0}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Үнэ (₮)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Бөөний үнэ *" htmlFor="base_price">
            <Input
              id="base_price"
              name="base_price"
              type="number"
              min={0}
              step={50}
              required
              defaultValue={defaults.base_price ?? ""}
            />
          </Field>
          <Field
            label="Бэлэн мөнгөний үнэ"
            htmlFor="cash_price"
            help="Зөвхөн дотоод лавлагаа. Худалдан авагчид харагдахгүй."
          >
            <Input
              id="cash_price"
              name="cash_price"
              type="number"
              min={0}
              step={50}
              defaultValue={defaults.cash_price ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Зураг</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewUrl && (
            <div className="relative w-32 h-32 rounded border overflow-hidden bg-muted">
              <Image src={previewUrl} alt="" fill className="object-cover" sizes="128px" />
            </div>
          )}
          <Input
            type="file"
            name="image"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPreviewUrl(URL.createObjectURL(file));
            }}
          />
          <p className="text-xs text-muted-foreground">
            5MB хүртэлх JPG/PNG/WebP. Хоосон үлдээвэл одоогийн зураг хадгалагдана.
          </p>
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
            Идэвхтэй (худалдан авагчид харагдана)
          </Label>
        </CardContent>
      </Card>

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
