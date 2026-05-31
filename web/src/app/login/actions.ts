"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapAuthError } from "@/lib/auth";
import { normalizeMnPhone } from "@/lib/sms/verify-mn";

/**
 * Phone-only login. Supabase Auth's signInWithPassword({ phone })
 * matches against auth.users.phone — which has historically been
 * stored both with and without the leading "+" depending on the
 * supabase-auth version. We try E.164 first, then strip and retry,
 * so users created in either format can sign in.
 *
 * On failure the raw phone the user typed is preserved in the
 * redirect URL so the input pre-fills next render — only the
 * password ever clears.
 */
export async function signIn(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const rawPhone = String(formData.get("phone") ?? "").trim();

  // Helper: always pass the typed phone back to the form so the user
  // doesn't have to retype it after a wrong password.
  const phoneError = (msg: string) =>
    `/login?phone=${encodeURIComponent(rawPhone)}&error=${encodeURIComponent(msg)}`;

  if (!password) {
    redirect(phoneError(mapAuthError("missing-credentials", "login")));
  }

  const e164 = normalizeMnPhone(rawPhone);
  if (!e164) {
    redirect(
      phoneError("Утасны дугаар буруу байна (жишээ нь: 99112233)."),
    );
  }
  const noPlus = e164.startsWith("+") ? e164.slice(1) : e164;

  const supabase = await createClient();
  let { error } = await supabase.auth.signInWithPassword({
    phone: e164,
    password,
  });
  if (error) {
    console.warn(
      "[login] phone signIn (E.164) failed:",
      error.code,
      error.message,
    );
    if (/invalid.*credentials|invalid.*login/i.test(error.message)) {
      const retry = await supabase.auth.signInWithPassword({
        phone: noPlus,
        password,
      });
      if (retry.error) {
        console.warn(
          "[login] phone signIn (no-plus) failed:",
          retry.error.code,
          retry.error.message,
        );
      }
      error = retry.error;
    }
  }
  if (error) {
    console.error("[login] final phone signIn error:", error);
    redirect(phoneError(mapAuthError(error, "login")));
  }
  redirect("/");
}
