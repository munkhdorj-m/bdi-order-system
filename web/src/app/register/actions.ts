"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapAuthError, siteUrl } from "@/lib/auth";

const MIN_PASSWORD = 8;

export async function registerUser(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !email || !password) {
    redirect(
      `/register?error=${encodeURIComponent(mapAuthError("missing-fields", "register"))}`,
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/register?error=${encodeURIComponent(mapAuthError("passwords-dont-match", "register"))}`,
    );
  }

  if (password.length < MIN_PASSWORD) {
    redirect(
      `/register?error=${encodeURIComponent(mapAuthError("password-too-short", "register"))}`,
    );
  }

  const supabase = await createClient();

  // emailRedirectTo lands the post-confirmation user at /auth/callback?type=signup,
  // which our callback route then forwards to "/" so homePathForRole takes over.
  // Supabase only includes fullName in the user_metadata payload — the profile
  // row is created by an auth.users trigger, so we don't need to touch profiles
  // here. (See the on_auth_user_created trigger in docs/schema.sql.)
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      data: { full_name: fullName },
    },
  });

  if (signUpError) {
    // Server-only diagnostic — Supabase's auth errors are wide-ranging and
    // the user-facing message is intentionally generic for register, so the
    // raw error needs to live in server logs for us to debug.
    console.error("[register] signUp failed:", {
      code: signUpError.code,
      message: signUpError.message,
      status: signUpError.status,
    });
    redirect(
      `/register?error=${encodeURIComponent(mapAuthError(signUpError, "register"))}`,
    );
  }

  // Supabase v2 obfuscates "this email is already registered" by returning a
  // user object with an empty identities array (and no session) instead of an
  // error — designed to prevent account enumeration on public sites. For our
  // B2B context that masking just confuses real users, so detect it
  // explicitly and tell them the email is taken.
  const identities = data?.user?.identities ?? [];
  if (identities.length === 0) {
    redirect(
      `/register?error=${encodeURIComponent("Энэ имэйл аль хэдийн бүртгэлтэй байна. Нэвтрэх эсвэл нууц үгээ сэргээнэ үү.")}`,
    );
  }

  // Confirm-email flow: user can't sign in until they click the link, so show
  // the "check your email" state with the address echoed back.
  redirect(`/register?sent=${encodeURIComponent(email)}`);
}
