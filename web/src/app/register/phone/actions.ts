"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapAuthError } from "@/lib/auth";
import {
  createPhoneVerification,
  normalizeMnPhone,
} from "@/lib/sms/verify-mn";
import {
  finalizeRegistration,
  parsePendingDraft,
  PENDING_COOKIE,
  type RegisterDraft,
} from "@/lib/register-finalize";

// ---------- tunables ----------
const MIN_PASSWORD = 8;

// Cookie carrying the in-flight registration draft between the phone-entry
// step and the verify step. httpOnly so JS can't read the password.
// 10-minute TTL matches verify.mn's 300s session window plus a buffer.
const PENDING_COOKIE_TTL_S = 600;

type PendingDraft = RegisterDraft;

async function setPendingCookie(draft: PendingDraft): Promise<void> {
  const store = await cookies();
  store.set(PENDING_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_COOKIE_TTL_S,
  });
}

async function readPendingCookie(): Promise<PendingDraft | null> {
  const store = await cookies();
  return parsePendingDraft(store.get(PENDING_COOKIE)?.value);
}

async function clearPendingCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
}

/**
 * Best-guess site origin from request headers, falling back to
 * NEXT_PUBLIC_SITE_URL. Used for the callback URL we hand to verify.mn —
 * which MUST be HTTPS and absolute.
 */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${proto}://${host}`;
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  throw new Error("Could not determine site origin for verify.mn callback");
}

/**
 * Phone format normalization. We pass +976XXXXXXXX (E.164) to verify.mn
 * because that's what its API expects, but Supabase Auth stores phones
 * WITHOUT the leading "+". So when comparing against auth.users or
 * profiles.phone, we need to check both forms.
 */
function phoneVariants(phone: string): string[] {
  const withPlus = phone.startsWith("+") ? phone : `+${phone}`;
  const noPlus = phone.startsWith("+") ? phone.slice(1) : phone;
  return [withPlus, noPlus];
}

// ============================================================
// startVerification — collect name + phone + password, kick off a
// verify.mn session, stash the draft in an httpOnly cookie, redirect
// to the verify page where the user is shown the smsUri / instructions.
// ============================================================
export async function startVerification(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Овог нэрээ оруулна уу.")}`,
    );
  }
  const phone = normalizeMnPhone(rawPhone);
  if (!phone) {
    redirect(
      `/register/phone?error=${encodeURIComponent(
        "Утасны дугаар буруу байна (жишээ нь: 99112233).",
      )}&name=${encodeURIComponent(fullName)}`,
    );
  }
  if (!password || password.length < MIN_PASSWORD) {
    redirect(
      `/register/phone?error=${encodeURIComponent(
        `Нууц үг хамгийн багадаа ${MIN_PASSWORD} тэмдэгт байх ёстой.`,
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }
  if (password !== confirmPassword) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Нууц үг таарахгүй байна.")}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // Duplicate-check BEFORE calling verify.mn — every verify.mn session
  // costs 150₮ per verified phone, so we want to fail fast if the
  // phone is already registered. We also save the user a wasted SMS.
  {
    const admin = createAdminClient();
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, active")
      .in("phone", phoneVariants(phone))
      .maybeSingle();
    if (existingProfile?.id) {
      redirect(
        `/login?phone=${encodeURIComponent(rawPhone)}&error=${encodeURIComponent(
          existingProfile.active
            ? "Энэ утас аль хэдийн бүртгэлтэй байна. Нэвтэрнэ үү."
            : "Энэ утас бүртгэгдсэн ба админы баталгаажилт хүлээж байна. Бид баталгаажуулмагц нэвтрэх боломжтой.",
        )}`,
      );
    }
  }

  const origin = await siteOrigin();

  // verify.mn fires its callback to a fixed URL with no per-session
  // substitution, and that server-to-server ping has no user cookie — so
  // it can't create the account (no password). We point it at a no-op and
  // do account creation server-side from the poll route + completeVerification
  // (both of which DO carry the user's cookie). The callback is just an ack.
  let session;
  try {
    session = await createPhoneVerification({
      phone,
      callbackUrl: `${origin}/api/verify-mn/callback/noop`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[register/phone] createPhoneVerification failed:", msg);
    redirect(
      `/register/phone?error=${encodeURIComponent(
        mapAuthError("verify-mn-failed", "register"),
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // Track the session so callback + poll can confirm verification.
  const admin = createAdminClient();
  const { error: insertErr } = await admin.from("verify_mn_sessions").insert({
    session_id: session.sessionId,
    phone,
    purpose: "register",
    code: session.text,
    sms_uri: session.smsUri,
    display_instruction: session.displayInstruction,
    verified: false,
    expires_at: session.expiresAt,
  });
  if (insertErr) {
    console.error(
      "[register/phone] verify_mn_sessions insert failed:",
      insertErr.message,
    );
    redirect(
      `/register/phone?error=${encodeURIComponent(
        "Алдаа гарлаа. Дахин оролдоно уу.",
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  await setPendingCookie({
    sessionId: session.sessionId,
    phone,
    fullName,
    password,
  });

  redirect(
    `/register/phone/verify?session=${encodeURIComponent(session.sessionId)}`,
  );
}

// ============================================================
// completeVerification — called from the verify page's client poller once
// the session is verified. The poll route may have already created the
// account server-side (see api/verify-mn/poll); finalizeRegistration is
// idempotent, so this either creates it or finds the existing one, then
// lands the user back on /login.
// ============================================================
export async function completeVerification() {
  const pending = await readPendingCookie();
  if (!pending) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Бүртгэлийн мэдээлэл хугацаа дууссан. Дахин эхлүүлнэ үү.")}`,
    );
  }

  const result = await finalizeRegistration(pending);

  if (result.status === "not_verified") {
    redirect(
      `/register/phone/verify?session=${encodeURIComponent(pending.sessionId)}&error=${encodeURIComponent("Утас баталгаажаагүй байна.")}`,
    );
  }

  if (result.status === "error") {
    console.error("[register/phone] finalize failed:", result.message);
    redirect(
      `/register/phone/verify?session=${encodeURIComponent(pending.sessionId)}&error=${encodeURIComponent("Бүртгэл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.")}`,
    );
  }

  // created | exists → registration is done; drop the draft cookie.
  await clearPendingCookie();

  if (result.status === "exists" && result.active) {
    redirect(
      `/login?phone=${encodeURIComponent(pending.phone)}&error=${encodeURIComponent("Энэ утас аль хэдийн бүртгэлтэй байна. Нэвтэрнэ үү.")}`,
    );
  }

  redirect("/login?success=phone-verified");
}
