"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Defaults = {
  name?: string;
  description?: string | null;
  active?: boolean;
};

type ActionState = { error?: string; ok?: boolean };

type Props = {
  defaults?: Defaults;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
};

export function PriceListMetaForm({ defaults = {}, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name" className="mb-1.5 block">Нэр *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaults.name ?? ""}
          placeholder="Жишээ нь: Nomin / CU / GS25"
        />
      </div>

      <div>
        <Label htmlFor="description" className="mb-1.5 block">Тайлбар</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaults.description ?? ""}
          placeholder="Тайлбар (заавал биш)"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="active"
          name="active"
          type="checkbox"
          defaultChecked={defaults.active ?? true}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="active" className="font-normal">Идэвхтэй</Label>
      </div>

      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
          {state.error}
        </div>
      )}
      {state.ok && !state.error && !pending && (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-sm p-3">
          ✓ Хадгаллаа.
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Хадгалж байна..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
