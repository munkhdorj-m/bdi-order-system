"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUserPassword } from "@/app/admin/users/actions";

const MIN_PASSWORD = 8;
/** No look-alikes (0/o, 1/l/i), so it reads cleanly over the phone. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function generatePassword(length = 10): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join("");
}

/**
 * Admin sets a new password for a user who forgot theirs.
 *
 * Opens with a random password already filled in (editable, or roll a new
 * one). The field is plain text on purpose: the admin has to read it out
 * to the user. After saving, the password stays on screen with a copy
 * button until the admin closes it.
 */
export function ResetPasswordPanel({
  userId,
  isSelf,
}: {
  userId: string;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const r = await setUserPassword(userId, value);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setSaved(value);
      setValue("");
      setOpen(false);
      toast.success("Нууц үг солигдлоо");
    });
  }

  async function copy() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Хуулж чадсангүй — гараар тэмдэглэнэ үү.");
    }
  }

  if (saved) {
    return (
      <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900 p-4 space-y-3 max-w-md">
        <div className="text-[13.5px] font-bold text-emerald-800 dark:text-emerald-300">
          Нууц үг солигдлоо
        </div>
        <p className="text-[12.5px] text-emerald-800/85 dark:text-emerald-300/85 leading-relaxed">
          {isSelf
            ? "Дараагийн удаа энэ нууц үгээр нэвтэрнэ."
            : "Хэрэглэгчид энэ нууц үгийг хэлээрэй. Энэ цонхыг хаасны дараа дахин харагдахгүй."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-[15px] font-bold tracking-wider rounded-lg bg-background px-3 py-1.5 ring-1 ring-border select-all">
            {saved}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Хуулсан" : "Хуулах"}
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSaved(null)}>
          Хаах
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setValue(generatePassword());
          setOpen(true);
        }}
      >
        <KeyRound className="h-4 w-4" />
        Нууц үг солих
      </Button>
    );
  }

  const tooShort = value.length < MIN_PASSWORD;

  return (
    <div className="rounded-2xl ring-1 ring-border bg-card p-4 space-y-3 max-w-md">
      <div>
        <Label htmlFor="new-password" className="mb-1.5 block">
          Шинэ нууц үг
        </Label>
        <div className="flex gap-2">
          <Input
            id="new-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !tooShort && !pending) save();
            }}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            disabled={pending}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setValue(generatePassword())}
            disabled={pending}
            title="Өөр санамсаргүй нууц үг"
            aria-label="Өөр санамсаргүй нууц үг"
          >
            <Shuffle className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Хамгийн багадаа {MIN_PASSWORD} тэмдэгт. Санамсаргүй нууц үгийг хэвээр нь эсвэл өөрийнхөөрөө
          өөрчилж хадгалж болно.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={pending || tooShort}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Хадгалж байна...
            </>
          ) : (
            "Хадгалах"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setValue("");
          }}
          disabled={pending}
        >
          Цуцлах
        </Button>
      </div>
    </div>
  );
}
