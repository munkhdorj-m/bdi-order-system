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
  address?: string | null;
  contact_phone?: string | null;
  assigned_rep_id?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type RepOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ActionState = { error?: string };

type Props = {
  reps: RepOption[];
  defaults?: SupermarketFormDefaults;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
};

export function SupermarketForm({
  reps,
  defaults = {},
  action,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

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
