"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapAuthError } from "@/lib/auth";

const MIN_PASSWORD = 8;

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) {
    redirect(
      `/reset-password?error=${encodeURIComponent(mapAuthError("missing-password", "reset"))}`,
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/reset-password?error=${encodeURIComponent(mapAuthError("passwords-dont-match", "reset"))}`,
    );
  }

  if (password.length < MIN_PASSWORD) {
    redirect(
      `/reset-password?error=${encodeURIComponent(mapAuthError("password-too-short", "reset"))}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      `/reset-password?error=${encodeURIComponent(mapAuthError(error, "reset"))}`,
    );
  }

  redirect("/login?success=password-reset");
}
