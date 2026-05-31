"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { signIn } from "@/app/login/actions";

type Method = "phone" | "email";

/**
 * Login form with a Phone / Email tab toggle. Phone is the default tab
 * because the typical buyer is a store manager on their phone — they
 * don't have a corporate email address. The toggle still exposes
 * email-based login as a first-class option for office users and
 * admins who use a passworded email account.
 *
 * Both tabs submit to the same `signIn` server action; the action
 * reads `method` from the form to pick which signInWithPassword
 * variant to call.
 */
export function LoginMethodTabs({
  defaultError,
  defaultSuccess,
}: {
  defaultError?: string;
  defaultSuccess?: string;
}) {
  const [method, setMethod] = useState<Method>("phone");

  return (
    <>
      {/* Tab toggle — pill-shaped, primary fill on the active tab.
          Mirrors the buyer's "Ширхэг / Хайрцаг" unit toggle pattern. */}
      <div className="relative flex bg-muted rounded-full p-1 text-sm font-medium mb-5">
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow-sm transition-transform duration-200 ease-out ${
            method === "email" ? "translate-x-full" : "translate-x-0"
          }`}
        />
        <button
          type="button"
          onClick={() => setMethod("phone")}
          aria-pressed={method === "phone"}
          className={`relative z-10 flex-1 py-1.5 rounded-full text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            method === "phone" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <Phone className="h-3.5 w-3.5" />
          Утсаар
        </button>
        <button
          type="button"
          onClick={() => setMethod("email")}
          aria-pressed={method === "email"}
          className={`relative z-10 flex-1 py-1.5 rounded-full text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            method === "email" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          Имэйлээр
        </button>
      </div>

      <form action={signIn} className="space-y-4">
        {/* The action reads this to know which credential field to use. */}
        <input type="hidden" name="method" value={method} />

        {method === "phone" ? (
          <div>
            <label htmlFor="phone" className="input-label">
              Утасны дугаар
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoFocus
              autoComplete="tel"
              inputMode="numeric"
              placeholder="99112233"
              className="input-field"
            />
            <p className="text-caption2 text-muted-foreground mt-1.5">
              8 оронтой Монгол утас.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="email" className="input-label">
              Имэйл
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="name@example.com"
              className="input-field"
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className="input-label">
            Нууц үг
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="input-field"
          />
        </div>

        {defaultSuccess && (
          <p className="text-caption rounded-lg px-3 py-2 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {defaultSuccess === "password-reset"
              ? "Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ нэвтэрнэ үү."
              : defaultSuccess === "phone-verified"
                ? "Утас баталгаажлаа. BDI-н ажилтан таны бүртгэлийг идэвхжүүлмэгц нэвтэрч орох боломжтой."
                : defaultSuccess}
          </p>
        )}
        {defaultError && (
          <p
            className="text-caption rounded-lg px-3 py-2 bg-destructive/10 text-destructive"
            role="alert"
          >
            {defaultError}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <Link
            href="/forgot-password"
            className="text-caption2 text-primary hover:underline"
          >
            Нууц үг мартсан?
          </Link>
        </div>

        <button type="submit" className="btn-primary w-full">
          Нэвтрэх
        </button>
      </form>
    </>
  );
}
