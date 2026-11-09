import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "rep" | "buyer";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  supermarket_id: string | null;
  active: boolean;
};

export type SessionContext = {
  userId: string;
  profile: Profile;
};

/**
 * The signed-in user + their profile, once per request.
 *
 * - getClaims() verifies the session JWT locally (the project signs with an
 *   ES256 key), so no Auth-server round trip — getUser() cost one per call.
 * - React cache() shares the result between the layout, the page and any
 *   guards in the same request instead of repeating it each time.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (claimsError || !userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, supermarket_id, active")
    .eq("id", userId)
    .single();

  if (error || !profile) return null;

  return {
    userId,
    profile: profile as Profile,
  };
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Admin-only guard for server actions. Returns a Mongolian error message
 * if the caller isn't an admin, or `null` if they pass.
 *
 * Use this at the top of every mutating admin action — layout-level
 * checks (admin/layout.tsx) only catch page navigations, NOT direct POSTs
 * to server actions. Without an explicit guard here a signed-in
 * non-admin (rep, buyer) could call any "use server" action by crafting
 * the POST themselves.
 *
 * Two call-site patterns depending on the action's return type:
 *
 *   // Action returns ActionState
 *   const guardErr = await adminGuardError();
 *   if (guardErr) return { error: guardErr };
 *
 *   // Action returns void or throws
 *   const guardErr = await adminGuardError();
 *   if (guardErr) throw new Error(guardErr);
 */
export async function adminGuardError(): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Нэвтэрнэ үү.";
  if (!hasActiveRole(session.profile, "admin")) {
    return "Зөвхөн идэвхтэй админ хийх боломжтой.";
  }
  return null;
}

/**
 * In this role AND switched on. Every area (admin, rep, store) and every
 * guard uses this — a user an admin set to "Идэвхгүй" must lose access at
 * once, whatever their role.
 */
export function hasActiveRole(profile: Profile, role: UserRole): boolean {
  return profile.active === true && profile.role === role;
}

export function homePathForRole(profile: Profile): string {
  // A store user without a store is a sign-up waiting for approval —
  // giving them a store is what approves (and switches on) the account.
  // Checked before `active`, or every new sign-up would be told their
  // account had been switched off.
  if (profile.role === "buyer" && !profile.supermarket_id) return "/pending";
  if (!profile.active) return "/inactive";
  switch (profile.role) {
    case "admin":
      return "/admin";
    case "rep":
      return "/rep";
    case "buyer":
      return "/catalog";
  }
}

/* ============================================================
 * Passwords
 * ============================================================ */

export const MIN_PASSWORD = 8;
/** bcrypt (Supabase Auth) reads only 72 bytes; a Cyrillic letter is 2. */
export const MAX_PASSWORD_BYTES = 72;

/** Why a new password is refused, as an AUTH_MESSAGES code — or null if it's fine. */
export function passwordErrorCode(
  password: string,
): "password-short" | "password-long" | null {
  if (password.length < MIN_PASSWORD) return "password-short";
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "password-long";
  }
  return null;
}

/* ============================================================
 * Messages on the login / sign-up / reset pages
 * ============================================================
 * Those pages show a message from the URL (?error=… / ?success=…). Only
 * these codes are ever rendered — never the raw query text, which would let
 * anyone put their own words (a fake phone number to call…) on the real
 * BDI login page via a link.
 */
export const AUTH_MESSAGES = {
  credentials: "Утас эсвэл нууц үг буруу байна.",
  "phone-unconfirmed": "Утасны дугаараа баталгаажуулна уу.",
  "rate-limit": "Хэт олон удаа оролдсон тул түр хүлээгээд дахин оролдоно уу.",
  "weak-password": "Нууц үг шаардлага хангахгүй байна.",
  "same-password": "Шинэ нууц үг өмнөхөөс өөр байх ёстой.",
  "phone-taken": "Энэ утасны дугаар аль хэдийн ашиглагдаж байна.",
  "register-failed": "Бүртгэл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.",
  "phone-invalid": "Утасны дугаар буруу байна (жишээ нь: 99112233).",
  "signup-disabled":
    "Шинэ бүртгэл хүлээж аваагүй байна. BDI-н ажилтантай холбогдоно уу.",
  "missing-credentials": "Бүх талбарыг бөглөнө үү.",
  "name-required": "Овог нэрээ оруулна уу.",
  "password-short": `Нууц үг хамгийн багадаа ${MIN_PASSWORD} тэмдэгт байх ёстой.`,
  "password-long": "Нууц үг хэт урт байна.",
  "password-mismatch": "Нууц үг таарахгүй байна.",
  "sms-start-failed": "SMS баталгаажуулалт эхлүүлж чадсангүй. Дахин оролдоно уу.",
  "too-many-sms":
    "Хэт олон удаа оролдлоо. 30 минутын дараа дахин оролдоно уу.",
  // Exact text VerifyMnPoller puts in the URL when a session runs out.
  "session-expired": "Сессийн хугацаа дууссан. Дахин эхлүүлнэ үү.",
  "draft-expired": "Хугацаа дууссан байна. Дахин эхлүүлнэ үү.",
  "session-missing":
    "Сесс олдсонгүй эсвэл аль хэдийн ашиглагдсан. Дахин эхлүүлнэ үү.",
  "not-verified": "Утас баталгаажаагүй байна.",
  "already-registered": "Энэ утас аль хэдийн бүртгэлтэй байна. Нэвтэрнэ үү.",
  "no-account":
    "Энэ дугаараар бүртгэл олдсонгүй. Шинээр бүртгүүлэх эсвэл BDI-тэй холбогдоно уу.",
  "no-profile": "Бүртгэл олдсонгүй. BDI-тэй холбогдоно уу.",
  generic: "Алдаа гарлаа. Дахин оролдоно уу.",
  // ?success=…
  "phone-verified":
    "Утас баталгаажлаа. BDI-н ажилтан таны бүртгэлийг идэвхжүүлмэгц нэвтэрч орох боломжтой.",
  "password-reset": "Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.",
} as const;

export type AuthMessageCode = keyof typeof AUTH_MESSAGES;

const KNOWN_TEXTS = new Set<string>(Object.values(AUTH_MESSAGES));

/**
 * The text for a ?error= / ?success= value, or null. Accepts a code, or
 * one of our own texts verbatim (the shared verify poller sends the
 * "session expired" text itself) — anything else shows nothing.
 */
export function authMessage(param: string | undefined): string | null {
  if (!param) return null;
  if (Object.hasOwn(AUTH_MESSAGES, param)) {
    return AUTH_MESSAGES[param as AuthMessageCode];
  }
  return KNOWN_TEXTS.has(param) ? param : null;
}

/**
 * A Supabase Auth error → message code. Unknown errors become "generic":
 * raw Supabase text never reaches the user or the URL.
 * `context: "register"` folds "already exists" into a generic failure so
 * the form can't be used to probe which phones are registered.
 */
export function authErrorCode(
  error: { message?: string; code?: string } | null | undefined,
  context: "login" | "register" = "login",
): AuthMessageCode {
  const key = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();

  // Order matters — more specific patterns come first.
  if (key.includes("invalid login credentials") || key.includes("invalid_credentials")) {
    return "credentials";
  }
  if (key.includes("phone not confirmed")) return "phone-unconfirmed";
  if (key.includes("rate limit") || key.includes("too many")) return "rate-limit";
  if (
    key.includes("password should be at least") ||
    key.includes("password_too_short") ||
    key.includes("weak_password")
  ) {
    return "weak-password";
  }
  if (key.includes("new password should be different") || key.includes("same_password")) {
    return "same-password";
  }
  if (
    key.includes("already registered") ||
    key.includes("user_exists") ||
    key.includes("phone_exists") ||
    key.includes("already in use") ||
    key.includes("duplicate key value") ||
    key.includes("unique_violation")
  ) {
    return context === "register" ? "register-failed" : "phone-taken";
  }
  if (
    key.includes("database error saving") ||
    key.includes("error saving new user") ||
    key.includes("unexpected_failure")
  ) {
    // A trigger or rule on profiles refused the row; the server log has it.
    return "register-failed";
  }
  if (key.includes("phone") && key.includes("invalid")) return "phone-invalid";
  if (key.includes("signups not allowed") || key.includes("signup_disabled")) {
    return "signup-disabled";
  }
  return "generic";
}

/** Same mapping, as text — for screens that show the message directly. */
export function mapAuthError(
  error: { message?: string; code?: string } | null | undefined,
  context: "login" | "register" = "login",
): string {
  return AUTH_MESSAGES[authErrorCode(error, context)];
}
