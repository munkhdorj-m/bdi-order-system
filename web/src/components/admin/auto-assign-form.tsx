"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionState = { error?: string; ok?: boolean };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

export function AutoAssignForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="keywords" className="mb-1.5 block">
          Түлхүүр үг (таслалаар тусгаарла)
        </Label>
        <Input
          id="keywords"
          name="keywords"
          required
          placeholder="жишээ нь: Nomin, Номин"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Дэлгүүрийн нэр, хаяг эсвэл тэмдэглэлд тохирох үг агуулсан бүх дэлгүүрт
          энэ жагсаалтыг оноох.
        </p>
      </div>

      {/* state.error doubles as the success message holder (returned with ok:true) */}
      {state.error && (
        <div
          className={`rounded-md border text-sm p-3 ${
            state.ok
              ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {state.ok ? "✓ " : ""}
          {state.error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          <Sparkles className="h-4 w-4" />
          {pending ? "Тооцоолж байна..." : "Бөөнөөр оноох"}
        </Button>
      </div>
    </form>
  );
}
