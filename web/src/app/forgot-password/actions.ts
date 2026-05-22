"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapAuthError, siteUrl } from "@/lib/auth";

export async function sendResetEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(mapAuthError("missing-email", "forgot"))}`,
    );
  }

  const supabase = await createClient();

  // redirectTo points the email link at our callback route, which
  // recognizes type=recovery and forwards to /reset-password.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback`,
  });

  if (error) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(mapAuthError(error, "forgot"))}`,
    );
  }

  redirect(`/forgot-password?sent=${encodeURIComponent(email)}`);
}
