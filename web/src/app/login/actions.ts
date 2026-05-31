"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapAuthError } from "@/lib/auth";
import { normalizeMnPhone } from "@/lib/sms/verify-mn";

/**
 * Unified login server action. Reads `method` from the form to know
 * whether to authenticate by phone or email, then calls Supabase
 * signInWithPassword with the matching field. Both paths route on
 * success to `/`, which then redirects to the role-specific home via
 * `homePathForRole`.
 *
 * Phone format: Supabase Auth stores phones WITHOUT the leading "+",
 * but the supabase-js client normalizes E.164 input for us. We
 * normalize the user's typed phone via `normalizeMnPhone` (which
 * returns "+976XXXXXXXX") and strip the leading "+" before passing
 * to Supabase so the stored vs supplied formats match exactly.
 */
export async function signIn(formData: FormData) {
  const method = String(formData.get("method") ?? "phone").trim();
  const password = String(formData.get("password") ?? "");

  if (!password) {
    redirect(
      `/login?error=${encodeURIComponent(mapAuthError("missing-credentials", "login"))}`,
    );
  }

  const supabase = await createClient();

  if (method === "email") {
    const email = String(formData.get("email") ?? "").trim();
    // Keep `email` in any error redirect so the input pre-fills on the
    // next render — only the password should reset on failure.
    const errorRedirect = (msg: string) =>
      `/login?method=email&email=${encodeURIComponent(email)}&error=${encodeURIComponent(msg)}`;
    if (!email) {
      redirect(errorRedirect(mapAuthError("missing-credentials", "login")));
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      redirect(errorRedirect(mapAuthError(error, "login")));
    }
    redirect("/");
  }

  // Default branch: phone login.
  const rawPhone = String(formData.get("phone") ?? "").trim();
  // Keep the typed phone in any error redirect so it pre-fills next
  // render. We pass the raw user input (not the normalized E.164) so
  // the user sees exactly what they typed.
  const phoneError = (msg: string) =>
    `/login?method=phone&phone=${encodeURIComponent(rawPhone)}&error=${encodeURIComponent(msg)}`;
  const e164 = normalizeMnPhone(rawPhone);
  if (!e164) {
    redirect(phoneError("Утасны дугаар буруу байна (жишээ нь: 99112233)."));
  }

  // Try E.164 first (the supabase-js documented format). If that
  // returns invalid-credentials, fall back to the stripped form —
  // we've observed both formats land in auth.users.phone across
  // supabase-auth versions. Either matches the same user; we just
  // need to figure out which one the row holds.
  const noPlus = e164.startsWith("+") ? e164.slice(1) : e164;
  let { error } = await supabase.auth.signInWithPassword({
    phone: e164,
    password,
  });
  if (error) {
    // First-attempt failure — log the raw Supabase error so we can
    // diagnose from Vercel function logs. Specifically helpful for
    // distinguishing "phone provider disabled at project level"
    // (Supabase returns a specific code) vs "user doesn't exist" vs
    // "wrong password".
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
