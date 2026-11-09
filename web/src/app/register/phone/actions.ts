"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passwordErrorCode, type AuthMessageCode } from "@/lib/auth";
import { localMnNumber, normalizeMnPhone } from "@/lib/sms/verify-mn";
import { startSmsSession } from "@/lib/sms/sessions";
import {
  MAX_FULL_NAME,
  REGISTER_DRAFT_COOKIE,
  draftCookieOptions,
  readRegisterDraft,
  sealRegisterDraft,
} from "@/lib/sms/draft-cookie";
import { finalizeRegistration } from "@/lib/register-finalize";

/** Back to the form with a message code; name and number stay filled in. */
function backToForm(code: AuthMessageCode, fields: { name?: string; phone?: string } = {}): never {
  const q = new URLSearchParams({ error: code });
  if (fields.name) q.set("name", fields.name);
  if (fields.phone) q.set("phone", fields.phone);
  redirect(`/register/phone?${q}`);
}

// ============================================================
// startVerification — collect name + phone + password, open a verify.mn
// check, keep the draft in a sealed httpOnly cookie, go to the verify page.
//
// Deliberately answers the same whether or not the phone already has an
// account: that is only told after the owner has texted the code (see
// completeVerification), so the form can't be used to look up who is a
// BDI customer.
// ============================================================
export async function startVerification(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, MAX_FULL_NAME);
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName) backToForm("name-required", { phone: rawPhone });
  const phone = normalizeMnPhone(rawPhone);
  if (!phone) backToForm("phone-invalid", { name: fullName, phone: rawPhone });
  const fields = { name: fullName, phone: localMnNumber(phone) };

  // Checked before the (paid) SMS, including bcrypt's 72-byte limit.
  const passwordProblem = passwordErrorCode(password);
  if (passwordProblem) backToForm(passwordProblem, fields);
  if (password !== confirmPassword) backToForm("password-mismatch", fields);

  const started = await startSmsSession(phone, "register");
  if ("error" in started) backToForm(started.error, fields);

  (await cookies()).set(
    REGISTER_DRAFT_COOKIE,
    sealRegisterDraft({ sessionId: started.sessionId, phone, fullName, password }),
    draftCookieOptions(),
  );

  redirect(`/register/phone/verify?session=${encodeURIComponent(started.sessionId)}`);
}

// ============================================================
// completeVerification — run by the verify page's poller once the check is
// verified. The poll route may already have created the account;
// finalizeRegistration is idempotent, so this creates it or finds it, then
// lands the user on /login.
// ============================================================
export async function completeVerification() {
  const store = await cookies();
  const draft = readRegisterDraft(store.get(REGISTER_DRAFT_COOKIE)?.value);
  if (!draft) backToForm("draft-expired");

  const result = await finalizeRegistration(draft);

  if (result.status === "not_verified") {
    redirect(
      `/register/phone/verify?session=${encodeURIComponent(draft.sessionId)}&error=not-verified`,
    );
  }
  if (result.status === "error") {
    console.error("[register/phone] finalize failed:", result.message);
    redirect(
      `/register/phone/verify?session=${encodeURIComponent(draft.sessionId)}&error=register-failed`,
    );
  }

  // created | exists → registration is done; drop the draft.
  store.delete(REGISTER_DRAFT_COOKIE);

  const phone = encodeURIComponent(localMnNumber(draft.phone));
  if (result.status === "exists" && result.active) {
    redirect(`/login?phone=${phone}&error=already-registered`);
  }
  redirect(`/login?phone=${phone}&success=phone-verified`);
}
