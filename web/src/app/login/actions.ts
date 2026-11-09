"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorCode, type AuthMessageCode } from "@/lib/auth";
import { normalizeMnPhone } from "@/lib/sms/verify-mn";

/**
 * Phone-only login. Supabase Auth's signInWithPassword({ phone })
 * matches against auth.users.phone — which has historically been
 * stored both with and without the leading "+" depending on the
 * supabase-auth version. We try E.164 first, then strip and retry,
 * so users created in either format can sign in.
 *
 * On failure the phone the user typed goes back into the form and the
 * error travels as a message code (the page shows only known messages).
 */
export async function signIn(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const rawPhone = String(formData.get("phone") ?? "").trim();

  function back(code: AuthMessageCode): never {
    redirect(`/login?${new URLSearchParams({ phone: rawPhone, error: code })}`);
  }

  if (!password) back("missing-credentials");

  const e164 = normalizeMnPhone(rawPhone);
  if (!e164) back("phone-invalid");
  const noPlus = e164.slice(1);

  const supabase = await createClient();
  let { data, error } = await supabase.auth.signInWithPassword({
    phone: e164,
    password,
  });
  if (error) {
    console.warn("[login] phone signIn (E.164) failed:", error.code, error.message);
    if (/invalid.*credentials|invalid.*login/i.test(error.message)) {
      ({ data, error } = await supabase.auth.signInWithPassword({
        phone: noPlus,
        password,
      }));
      if (error) {
        console.warn("[login] phone signIn (no-plus) failed:", error.code, error.message);
      }
    }
  }
  if (error) back(authErrorCode(error, "login"));

  // A login without a profile row would bounce / → /login forever with no
  // message (every page needs the profile). Say so and end the session.
  const userId = data.user?.id;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("id").eq("id", userId).maybeSingle()
    : { data: null };
  if (!profile) {
    console.error("[login] signed in but no profile row for user", userId);
    await supabase.auth.signOut({ scope: "local" });
    back("no-profile");
  }

  redirect("/");
}
