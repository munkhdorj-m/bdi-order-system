"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapAuthError } from "@/lib/auth";
import {
  createPhoneVerification,
  normalizeMnPhone,
} from "@/lib/sms/verify-mn";

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
 * The new password waits in an httpOnly cookie (10 min), never in the
 * database — same as the registration draft.
 */

const MIN_PASSWORD = 8;
const RESET_COOKIE = "bdi-password-reset";
const RESET_COOKIE_TTL_S = 600;
const PURPOSE = "password_reset";
/** A finished reset is re-labelled so its verified session can't be replayed. */
const PURPOSE_DONE = "password_reset_done";

type ResetDraft = { sessionId: string; phone: string; password: string };

function phoneVariants(phone: string): string[] {
  const noPlus = phone.replace(/^\+/, "");
  return [noPlus, `+${noPlus}`];
}

/** "+97699112233" → "99112233", for pre-filling forms. */
function localNumber(phone: string): string {
  return phone.replace(/^\+?976/, "");
}

function backToForm(message: string, phone?: string): never {
  const q = new URLSearchParams({ error: message });
  if (phone) q.set("phone", phone);
  redirect(`/forgot-password?${q}`);
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${proto}://${host}`;
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  throw new Error("Could not determine site origin for verify.mn callback");
}

async function readDraft(): Promise<ResetDraft | null> {
  const raw = (await cookies()).get(RESET_COOKIE)?.value;
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as ResetDraft;
    return typeof d?.sessionId === "string" &&
      typeof d?.phone === "string" &&
      typeof d?.password === "string"
      ? d
      : null;
  } catch {
    return null;
  }
}

// ============================================================
// startPasswordReset — validate, make sure the account exists, open a
// verify.mn session and send the user to the "send this SMS" page.
// ============================================================
export async function startPasswordReset(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const phone = normalizeMnPhone(rawPhone);
  if (!phone) {
    backToForm("Утасны дугаар буруу байна (жишээ нь: 99112233).", rawPhone);
  }
  if (password.length < MIN_PASSWORD) {
    backToForm(`Нууц үг хамгийн багадаа ${MIN_PASSWORD} тэмдэгт байх ёстой.`, rawPhone);
  }
  if (new TextEncoder().encode(password).length > 72) {
    backToForm("Нууц үг хэт урт байна.", rawPhone);
  }
  if (password !== confirmPassword) {
    backToForm("Нууц үг таарахгүй байна.", rawPhone);
  }

  const admin = createAdminClient();

  // Registration already tells people whether a number is registered, so
  // saying so here gives nothing away — and saves a wasted SMS.
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .in("phone", phoneVariants(phone))
    .limit(1)
    .maybeSingle();
  if (profileErr) {
    console.error("[forgot-password] profile lookup failed:", profileErr.message);
    backToForm("Алдаа гарлаа. Дахин оролдоно уу.", rawPhone);
  }
  if (!profile) {
    backToForm(
      "Энэ дугаараар бүртгэл олдсонгүй. Шинээр бүртгүүлэх эсвэл BDI-тэй холбогдоно уу.",
      rawPhone,
    );
  }

  const origin = await siteOrigin();
  let session;
  try {
    session = await createPhoneVerification({
      phone,
      // verify.mn needs a callback, but the poller is the source of truth
      // (see api/verify-mn/callback) — same no-op target as registration.
      callbackUrl: `${origin}/api/verify-mn/callback/noop`,
    });
  } catch (e) {
    console.error(
      "[forgot-password] createPhoneVerification failed:",
      e instanceof Error ? e.message : e,
    );
    backToForm("SMS баталгаажуулалт эхлүүлж чадсангүй. Дахин оролдоно уу.", rawPhone);
  }

  const { error: insertErr } = await admin.from("verify_mn_sessions").insert({
    session_id: session.sessionId,
    phone,
    purpose: PURPOSE,
    code: session.text,
    sms_uri: session.smsUri,
    display_instruction: session.displayInstruction,
    verified: false,
    expires_at: session.expiresAt,
  });
  if (insertErr) {
    console.error("[forgot-password] session insert failed:", insertErr.message);
    backToForm("Алдаа гарлаа. Дахин оролдоно уу.", rawPhone);
  }

  const draft: ResetDraft = { sessionId: session.sessionId, phone, password };
  (await cookies()).set(RESET_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RESET_COOKIE_TTL_S,
  });

  redirect(`/forgot-password/verify?session=${encodeURIComponent(session.sessionId)}`);
}

// ============================================================
// completePasswordReset — called by the verify page's poller once
// verify.mn reports VERIFIED. Re-checks everything server-side.
// ============================================================
export async function completePasswordReset() {
  const draft = await readDraft();
  if (!draft) {
    backToForm("Хугацаа дууссан байна. Дахин эхлүүлнэ үү.");
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("verify_mn_sessions")
    .select("phone, purpose, verified")
    .eq("session_id", draft.sessionId)
    .maybeSingle();
  // Must be THIS browser's reset session, for the same phone, not yet used.
  if (!row || row.purpose !== PURPOSE || row.phone !== draft.phone) {
    backToForm("Сесс олдсонгүй эсвэл аль хэдийн ашиглагдсан. Дахин эхлүүлнэ үү.", localNumber(draft.phone));
  }
  if (!row.verified) {
    redirect(
      `/forgot-password/verify?session=${encodeURIComponent(draft.sessionId)}&error=${encodeURIComponent("Утас баталгаажаагүй байна.")}`,
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .in("phone", phoneVariants(draft.phone))
    .limit(1)
    .maybeSingle();
  if (!profile) {
    backToForm("Энэ дугаараар бүртгэл олдсонгүй.", localNumber(draft.phone));
  }

  // phone_confirm too: they just proved they hold the number, and an
  // unconfirmed phone would block the sign-in that comes next.
  const { error } = await admin.auth.admin.updateUserById(profile.id, {
    password: draft.password,
    phone_confirm: true,
  });
  if (error) {
    console.error("[forgot-password] updateUserById failed:", error.message);
    backToForm(mapAuthError(error), localNumber(draft.phone));
  }

  await admin
    .from("verify_mn_sessions")
    .update({ purpose: PURPOSE_DONE })
    .eq("session_id", draft.sessionId);
  (await cookies()).delete(RESET_COOKIE);
  console.info("[forgot-password] password reset by SMS for user", profile.id);

  redirect(
    `/login?phone=${encodeURIComponent(localNumber(draft.phone))}&success=password-reset`,
  );
}
