"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createUserAccount } from "@/app/admin/users/actions";

type Role = "admin" | "rep" | "buyer";
type Method = "phone" | "email";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Админ",
  rep: "Төлөөлөгч",
  buyer: "Худалдан авагч",
};

export type SupermarketOption = {
  id: string;
  name: string;
  address?: string | null;
};

/**
 * Admin "create user on someone's behalf" form. Bypasses the normal
 * verify.mn / email-confirm signup flow because the admin is vouching
 * for the credentials — the resulting account lands active=true and
 * the user can log in immediately with whatever password the admin
 * set.
 */
export function UserCreateForm({
  supermarkets,
}: {
  supermarkets: SupermarketOption[];
}) {
  const [method, setMethod] = useState<Method>("phone");
  const [role, setRole] = useState<Role>("buyer");
  const [state, formAction, pending] = useActionState(createUserAccount, {});

  const storeOptions = supermarkets.map((s) => ({
    value: s.id,
    label: s.name,
    description: s.address ?? undefined,
  }));

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      {state?.error && (
        <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Identifier — Phone / Email toggle */}
      <section className="rounded-2xl bg-card ring-1 ring-border p-5 sm:p-6 space-y-4">
        <header>
          <h3 className="text-[14.5px] font-bold tracking-tight">
            Танигдах арга
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Хэрэглэгч энэ дугаар эсвэл имэйлээр нэвтрэх боломжтой
          </p>
        </header>

        <input type="hidden" name="method" value={method} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("phone")}
            aria-pressed={method === "phone"}
            className={`rounded-xl ring-1 p-3 text-left transition-all ${
              method === "phone"
                ? "ring-primary bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] shadow-sm"
                : "ring-border bg-card hover:bg-muted/40"
            }`}
          >
            <Phone
              className={`h-4 w-4 mb-1.5 ${method === "phone" ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="text-[13px] font-bold">Утсаар</div>
            <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
              Монгол утасны дугаар
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMethod("email")}
            aria-pressed={method === "email"}
            className={`rounded-xl ring-1 p-3 text-left transition-all ${
              method === "email"
                ? "ring-primary bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] shadow-sm"
                : "ring-border bg-card hover:bg-muted/40"
            }`}
          >
            <Mail
              className={`h-4 w-4 mb-1.5 ${method === "email" ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="text-[13px] font-bold">Имэйлээр</div>
            <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
              Корпорат имэйл
            </div>
          </button>
        </div>

        {method === "phone" ? (
          <div>
            <Label htmlFor="phone">Утасны дугаар *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="off"
              inputMode="numeric"
              placeholder="99112233"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              8 оронтой Монгол утас.
            </p>
          </div>
        ) : (
          <div>
            <Label htmlFor="email">Имэйл *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              placeholder="name@example.com"
              required
            />
          </div>
        )}

        <div>
          <Label htmlFor="password">Нууц үг *</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="Хамгийн багадаа 8 тэмдэгт"
            required
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Бий болгосон нууц үгээ хэрэглэгчид өг — хүсвэл хэрэглэгч өөрөө
            солих боломжтой.
          </p>
        </div>
      </section>

      {/* Profile section */}
      <section className="rounded-2xl bg-card ring-1 ring-border p-5 sm:p-6 space-y-4">
        <header>
          <h3 className="text-[14.5px] font-bold tracking-tight">
            Бүртгэлийн мэдээлэл
          </h3>
        </header>

        <div>
          <Label htmlFor="full_name">Бүтэн нэр</Label>
          <Input
            id="full_name"
            name="full_name"
            autoComplete="off"
            placeholder="Овог нэр"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="role">Эрх *</Label>
            <input type="hidden" name="role" value={role} />
            <Select
              value={role}
              onValueChange={(v) => setRole(v as Role)}
            >
              <SelectTrigger id="role" className="w-full h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === "buyer" && (
            <div>
              <Label>Дэлгүүр</Label>
              <SearchableSelect
                name="supermarket_id"
                options={storeOptions}
                placeholder="Дэлгүүр сонгох"
                searchPlaceholder="Нэр, хаягаар хайх..."
                emptyLabel="Дэлгүүр олдсонгүй"
                allowEmpty
                emptyOptionLabel="— Сонгоогүй —"
                className="h-10 rounded-xl"
              />
            </div>
          )}
        </div>
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} size="lg" className="px-6">
          {pending ? "Үүсгэж байна..." : "Хэрэглэгч үүсгэх"}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/admin/users">Цуцлах</Link>
        </Button>
      </div>
    </form>
  );
}
