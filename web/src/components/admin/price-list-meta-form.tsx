"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
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

      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && !state.error && !pending && (
        <Callout tone="success">✓ Хадгаллаа.</Callout>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Хадгалж байна..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
