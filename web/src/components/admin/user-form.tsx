"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type UserFormDefaults = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: "admin" | "rep" | "buyer";
  supermarket_id: string | null;
  active: boolean;
};

export type SupermarketOption = {
  id: string;
  name: string;
};

type ActionState = { error?: string };

type Props = {
  defaults: UserFormDefaults;
  supermarkets: SupermarketOption[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  isSelf: boolean;
};

const ROLE_LABELS: Record<"admin" | "rep" | "buyer", string> = {
  admin: "Админ",
  rep: "Төлөөлөгч",
  buyer: "Худалдан авагч",
};

export function UserForm({ defaults, supermarkets, action, isSelf }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );
  const [role, setRole] = useState(defaults.role);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Бүртгэлийн мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Имэйл</div>
              <div className="font-mono">{defaults.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Утас</div>
              <div className="font-mono">{defaults.phone ?? "—"}</div>
            </div>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="full_name" className="mb-1.5 block">
              Бүтэн нэр
            </Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={defaults.full_name ?? ""}
            />
          </div>

          <div>
            <Label htmlFor="role" className="mb-1.5 block">
              Эрх *
            </Label>
            <select
              id="role"
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              disabled={isSelf}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-60"
            >
              {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map(
                (r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ),
              )}
            </select>
            {isSelf && (
              <p className="text-xs text-muted-foreground mt-1">
                Өөрийн эрхийг өөрчилж болохгүй.
              </p>
            )}
          </div>

          {role === "buyer" && (
            <div>
              <Label htmlFor="supermarket_id" className="mb-1.5 block">
                Дэлгүүр
              </Label>
              <select
                id="supermarket_id"
                name="supermarket_id"
                defaultValue={defaults.supermarket_id ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">— Сонгох —</option>
                {supermarkets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <input
            id="active"
            name="active"
            type="checkbox"
            defaultChecked={defaults.active}
            disabled={isSelf}
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
          <Link href="/admin/users">Цуцлах</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Хадгалж байна..." : "Хадгалах"}
        </Button>
      </div>
    </form>
  );
}
