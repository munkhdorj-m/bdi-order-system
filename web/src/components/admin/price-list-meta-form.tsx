"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActiveSwitch } from "@/components/ui/active-switch";

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

      <ActiveSwitch
        defaultChecked={defaults.active ?? true}
        activeHint="Энэ үнийн жагсаалт дэлгүүрүүдэд оноогдох боломжтой."
        inactiveHint="Архивласан — шинэ дэлгүүрт оноогдохгүй."
      />

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
