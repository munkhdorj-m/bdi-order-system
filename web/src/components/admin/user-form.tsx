"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ActiveSwitch } from "@/components/ui/active-switch";

export type UserFormDefaults = {
  id: string;
  phone: string | null;
  full_name: string | null;
  role: "admin" | "rep" | "buyer";
  supermarket_id: string | null;
  active: boolean;
};

export type SupermarketOption = {
  id: string;
  name: string;
  address?: string | null;
  active?: boolean;
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

  const storeOptions = useMemo(
    () =>
      supermarkets.map((s) => ({
        value: s.id,
        label: s.name,
        // Address + an "идэвхгүй" flag for deactivated stores (also makes
        // them searchable by that word). Joined so the picker shows both.
        description:
          [s.address, s.active === false ? "идэвхгүй" : null]
            .filter(Boolean)
            .join(" · ") || undefined,
      })),
    [supermarkets],
  );

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Бүртгэлийн мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-sm">
            <div className="text-muted-foreground">Утас</div>
            <div className="font-mono">{defaults.phone ?? "—"}</div>
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
            <Select
              name="role"
              required
              value={role}
              onValueChange={(v) => setRole(v as typeof role)}
              disabled={isSelf}
            >
              <SelectTrigger
                id="role"
                size="default"
                className="w-full h-10 rounded-xl"
              >
                <SelectValue placeholder="Эрх сонгох" />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>
                ).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <SearchableSelect
                name="supermarket_id"
                options={storeOptions}
                defaultValue={defaults.supermarket_id ?? ""}
                placeholder="Дэлгүүр сонгох"
                searchPlaceholder="Нэр, хаягаар хайх..."
                emptyLabel="Дэлгүүр олдсонгүй"
                allowEmpty
                emptyOptionLabel="— Сонгоогүй —"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {storeOptions.length} дэлгүүрээс сонгох
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ActiveSwitch
        defaultChecked={defaults.active}
        disabled={isSelf}
        activeHint="Хэрэглэгч системд нэвтэрч ажиллах боломжтой."
        inactiveHint="Нэвтрэх боломжгүй — захиалга үүсгэх, харах боломжгүй."
        disabledHint="Та өөрийн эрхийн идэвхтэй төлвийг өөрчилж болохгүй."
      />

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
