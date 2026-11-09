"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { authErrorCode, passwordErrorCode, type AuthMessageCode } from "@/lib/auth";
import { localMnNumber, normalizeMnPhone, phoneVariants } from "@/lib/sms/verify-mn";
import {
  claimVerifiedSession,
  isPurpose,
  loadSmsSession,
  releaseSession,
  startSmsSession,
} from "@/lib/sms/sessions";
import {
  RESET_DRAFT_COOKIE,
  draftCookieOptions,
  readResetDraft,
  sealResetDraft,
} from "@/lib/sms/draft-cookie";

/**
 * Self-service password reset, proven by the same verify.mn check as
 * registration: the user texts a one-time code FROM their own phone to
 * 144773, which shows they hold that SIM. Nobody else can finish a reset
 * for a number without that phone, and no SMS is ever sent TO anyone, so
 * the form can't be used to spam people.
 *
 * Flow: phone + new password → verify page (send the SMS) → poller sees
 * VERIFIED → completePasswordReset sets the password → /login.
 *
 * The new password waits in a sealed httpOnly cookie (10 min), never in the
 * database — same as the registration draft.
 */

function backToForm(code: AuthMessageCode, phone?: string): never {
  const q = new URLSearchParams({ error: code });
  if (phone) q.set("phone", phone);
  redirect(`/forgot-password?${q}`);
}

// ============================================================
// startPasswordReset — validate, open a verify.mn check and send the user
// to the "send this SMS" page. Answers the same whether or not the number
// has an account; that is only told after the owner has texted the code.
// ============================================================
export async function startPasswordReset(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const phone = normalizeMnPhone(rawPhone);
  if (!phone) backToForm("phone-invalid", rawPhone);
  const passwordProblem = passwordErrorCode(password);
  if (passwordProblem) backToForm(passwordProblem, rawPhone);
  if (password !== confirmPassword) backToForm("password-mismatch", rawPhone);

  const started = await startSmsSession(phone, "password_reset");
  if ("error" in started) backToForm(started.error, rawPhone);

  (await cookies()).set(
    RESET_DRAFT_COOKIE,
    sealResetDraft({ sessionId: started.sessionId, phone, password }),
    draftCookieOptions(),
  );

  redirect(`/forgot-password/verify?session=${encodeURIComponent(started.sessionId)}`);
}

// ============================================================
// completePasswordReset — run by the verify page's poller once verify.mn
// reports VERIFIED. Re-checks everything server-side and uses the check
// exactly once.
// ============================================================
export async function completePasswordReset() {
  const store = await cookies();
  const draft = readResetDraft(store.get(RESET_DRAFT_COOKIE)?.value);
  if (!draft) backToForm("draft-expired");
  const local = localMnNumber(draft.phone);

  // Must be THIS browser's reset check, for the same phone, not yet used.
  const row = await loadSmsSession(draft.sessionId);
  if (!row || row.phone !== draft.phone || !isPurpose(row.purpose, "password_reset")) {
    backToForm("session-missing", local);
  }
  if (!row.verified) {
    redirect(
      `/forgot-password/verify?session=${encodeURIComponent(draft.sessionId)}&error=not-verified`,
    );
  }
  if (!(await claimVerifiedSession(draft.sessionId, draft.phone, "password_reset"))) {
    backToForm("session-missing", local);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .in("phone", phoneVariants(draft.phone))
    .limit(1)
    .maybeSingle();
  if (!profile) {
    // Only the phone's owner gets this far, so saying so leaks nothing.
    store.delete(RESET_DRAFT_COOKIE);
    backToForm("no-account", local);
  }

  // phone_confirm too: they just proved they hold the number, and an
  // unconfirmed phone would block the sign-in that comes next.
  const { error } = await admin.auth.admin.updateUserById(profile.id as string, {
    password: draft.password,
    phone_confirm: true,
  });
  if (error) {
    console.error("[forgot-password] updateUserById failed:", error.message);
    // Hand the check back so a retry doesn't need a new SMS.
    await releaseSession(draft.sessionId, "password_reset");
    backToForm(authErrorCode(error), local);
  }

  store.delete(RESET_DRAFT_COOKIE);
  console.info("[forgot-password] password reset by SMS for user", profile.id);

  redirect(`/login?phone=${encodeURIComponent(local)}&success=password-reset`);
}
