"use server";

import { createHash, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapAuthError } from "@/lib/auth";
import { normalizeMnPhone, sendSms } from "@/lib/sms/mobicom";

// ---------- tunables ----------
const OTP_LENGTH = 6;
const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 6;
const MIN_PASSWORD = 8;
// How many OTP rows a single phone is allowed to create in the last
// minute. Prevents an attacker (or a script) from racking up SMS costs.
const SEND_RATE_LIMIT_PER_MIN = 2;

// Cookie that carries the in-flight registration draft between the
// "enter phone + password" step and the "enter code" step. httpOnly so
// JS can't read it; 10-min TTL matches the OTP window.
const PENDING_COOKIE = "bdi-phone-register-pending";
const PENDING_COOKIE_TTL_S = OTP_TTL_MIN * 60;

// ---------- helpers ----------
function generateOtp(): string {
  // randomInt is uniform — Math.random is not. Range is [0, 10^OTP_LENGTH).
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

function hashOtp(phone: string, code: string): string {
  // Phone is included in the hash so a leaked code_hash can't be reused
  // against a different phone number.
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

type PendingDraft = {
  phone: string;
  fullName: string;
  password: string;
};

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
  const raw = store.get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingDraft;
    if (
      typeof parsed?.phone === "string" &&
      typeof parsed?.password === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function clearPendingCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
}

// ============================================================
// sendOtp — collect everything (phone, name, password, confirm),
// validate, persist a pending-registration cookie, then dispatch SMS.
// The verify step reads the cookie so the password never appears in a
// URL or hidden form field.
//
// Form fields:
//   phone            — string (raw user input; we normalize)
//   fullName         — full name (now required to match email flow)
//   password         — string ≥ MIN_PASSWORD chars
//   confirmPassword  — must match password
// ============================================================
export async function sendOtp(formData: FormData) {
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

  if (!password) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Нууц үг оруулна уу.")}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }
  if (password.length < MIN_PASSWORD) {
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

  const admin = createAdminClient();

  // ---- rate limit ----
  // Count rows in the last minute. We use the admin client because RLS
  // forbids public reads on phone_otp.
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("phone_otp")
    .select("*", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", oneMinAgo);
  if ((count ?? 0) >= SEND_RATE_LIMIT_PER_MIN) {
    redirect(
      `/register/phone?error=${encodeURIComponent(
        "Хэт олон удаа оролдсон тул түр хүлээгээд дахин оролдоно уу.",
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // ---- generate + store ----
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

  const { error: insertErr } = await admin.from("phone_otp").insert({
    phone,
    code_hash: hashOtp(phone, code),
    expires_at: expiresAt,
    purpose: "register",
  });
  if (insertErr) {
    console.error("[phone/sendOtp] insert failed:", insertErr);
    redirect(
      `/register/phone?error=${encodeURIComponent(
        "OTP үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.",
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // ---- send via Mobicom ----
  const sms = await sendSms({
    to: phone,
    text: `BDI: Таны баталгаажуулах код ${code}. ${OTP_TTL_MIN} минутын дотор оруулна уу.`,
  });
  if (!sms.ok) {
    console.error("[phone/sendOtp] SMS send failed:", sms.error);
    redirect(
      `/register/phone?error=${encodeURIComponent(
        "SMS илгээж чадсангүй. Дахин оролдоно уу.",
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // ---- stash full draft for the verify step ----
  // httpOnly cookie keeps the password out of the URL and out of JS. The
  // verify action reads it, creates the auth user with phone+password,
  // then deletes the cookie.
  await setPendingCookie({ phone, fullName, password });

  // Phone in URL is fine — it's not sensitive and lets the verify page
  // display "we sent the code to 99112233" without another lookup.
  redirect(`/register/phone/verify?phone=${encodeURIComponent(phone)}`);
}

// ============================================================
// verifyOtp — match the code, then create the auth user with the
// password we stashed at the previous step. The user can then log in
// at /login with their phone + password going forward.
// ============================================================
export async function verifyOtp(formData: FormData) {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!phone || !code) {
    redirect(
      `/register/phone/verify?phone=${encodeURIComponent(phone)}&error=${encodeURIComponent("Кодыг бүрэн оруулна уу.")}`,
    );
  }

  const pending = await readPendingCookie();
  if (!pending || pending.phone !== phone) {
    // Cookie expired or got cleared — push the user back to step 1 so
    // they can re-enter their password. We don't try to keep the
    // half-entered form here because the password is the missing piece.
    redirect(
      `/register/phone?error=${encodeURIComponent("Бүртгэлийн мэдээлэл хугацаа дууссан. Дахин эхлүүлнэ үү.")}`,
    );
  }

  const admin = createAdminClient();

  // ---- find the live row for this phone ----
  const { data: rows, error: fetchErr } = await admin
    .from("phone_otp")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchErr) {
    console.error("[phone/verifyOtp] fetch failed:", fetchErr);
    redirect(
      `/register/phone/verify?phone=${encodeURIComponent(phone)}&error=${encodeURIComponent("Алдаа гарлаа. Дахин оролдоно уу.")}`,
    );
  }

  const row = rows?.[0];
  if (!row) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Кодын хугацаа дууссан байна. Шинээр код авна уу.")}`,
    );
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Кодын хугацаа дууссан байна. Шинээр код авна уу.")}`,
    );
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Олон удаа буруу оролдсон. Шинээр код авна уу.")}`,
    );
  }

  if (hashOtp(phone, code) !== row.code_hash) {
    // Bump attempts but don't consume the row — user can retry.
    await admin
      .from("phone_otp")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    redirect(
      `/register/phone/verify?phone=${encodeURIComponent(phone)}&error=${encodeURIComponent("Код буруу байна.")}`,
    );
  }

  // ---- consume the row so the same code can't be replayed ----
  await admin
    .from("phone_otp")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  // ---- create the auth user with phone + password ----
  // phone_confirm:true marks the number as verified since we just
  // confirmed it ourselves. password is the one the user entered on
  // step 1 (carried via the httpOnly pending cookie).
  const { error: createErr } = await admin.auth.admin.createUser({
    phone,
    password: pending.password,
    phone_confirm: true,
    user_metadata: pending.fullName ? { full_name: pending.fullName } : undefined,
  });

  if (createErr && !/already (registered|exists)/i.test(createErr.message)) {
    console.error("[phone/verifyOtp] createUser failed:", createErr);
    redirect(
      `/register/phone/verify?phone=${encodeURIComponent(phone)}&error=${encodeURIComponent(mapAuthError(createErr, "register"))}`,
    );
  }

  // Drop the pending cookie now that we're done with the draft.
  await clearPendingCookie();

  // The on_auth_user_created trigger hydrates a profiles row with
  // active=false (fix 18) so the admin still has to approve the user
  // before they can log in. Send them to /login with a friendly
  // message — phone register flow doesn't auto-session because we
  // don't have a server-issued JWT for the new user.
  redirect("/login?success=phone-verified");
}
