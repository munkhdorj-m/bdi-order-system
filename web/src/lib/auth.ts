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
  email: string | null;
  profile: Profile;
};

export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, supermarket_id, active")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function homePathForRole(profile: Profile): string {
  if (!profile.active) return "/inactive";
  switch (profile.role) {
    case "admin":
      return "/admin";
    case "rep":
      return "/rep";
    case "buyer":
      return profile.supermarket_id ? "/catalog" : "/pending";
  }
}

/**
 * Public site URL used when handing redirect callbacks to Supabase (email
 * verification + password-reset links). Falls back to localhost for dev.
 * Set NEXT_PUBLIC_SITE_URL in deployed environments.
 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Localize Supabase auth errors to Mongolian + collapse enumeration vectors.
 *
 * - `context: "register"` deliberately maps "user already exists" to a
 *   generic message so attackers can't probe the registered-email list.
 * - `context: "login"` keeps Supabase's already-generic "Invalid login
 *   credentials" (same message for wrong email OR wrong password — already
 *   safe), but localizes it.
 * - Unknown errors fall through to a generic message rather than echoing
 *   raw Supabase strings into URL query params.
 */
type AuthErrorContext = "login" | "register" | "reset" | "forgot" | "callback";

export function mapAuthError(
  error: { message?: string; code?: string } | string,
  context: AuthErrorContext = "login",
): string {
  const msg = typeof error === "string" ? error : (error?.message ?? "");
  const code = typeof error === "string" ? "" : (error?.code ?? "");
  const key = `${code} ${msg}`.toLowerCase();

  // Order matters — more specific patterns come first.
  if (
    key.includes("invalid login credentials") ||
    key.includes("invalid_credentials")
  ) {
    return "Имэйл эсвэл нууц үг буруу байна.";
  }
  if (key.includes("email not confirmed")) {
    return "Имэйл хаягаа баталгаажуулна уу. Шуудангаа шалгана уу.";
  }
  if (key.includes("rate limit") || key.includes("too many")) {
    return "Хэт олон удаа оролдсон тул түр хүлээгээд дахин оролдоно уу.";
  }
  if (
    key.includes("password should be at least") ||
    key.includes("password_too_short") ||
    key.includes("weak_password")
  ) {
    return "Нууц үг шаардлага хангахгүй байна.";
  }
  if (
    key.includes("token has expired") ||
    key.includes("invalid token") ||
    key.includes("otp_expired")
  ) {
    return "Холбоосын хугацаа дууссан байна. Шинэ холбоос авна уу.";
  }
  if (key.includes("new password should be different")) {
    return "Шинэ нууц үг өмнөхөөс өөр байх ёстой.";
  }
  if (
    key.includes("user already registered") ||
    key.includes("user_exists") ||
    key.includes("already registered") ||
    key.includes("already in use") ||
    key.includes("duplicate key value") ||
    key.includes("profiles_pkey") ||
    key.includes("unique_violation")
  ) {
    // Register context: collapse to generic to prevent account enumeration.
    // Other contexts shouldn't normally hit this branch.
    if (context === "register") {
      return "Бүртгэл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.";
    }
    return "Энэ имэйл аль хэдийн ашиглагдаж байна.";
  }
  if (
    key.includes("database error saving") ||
    key.includes("error saving new user") ||
    key.includes("unexpected_failure")
  ) {
    // Trigger or RLS on profiles is rejecting the insert. Server logs have
    // the real cause; the user sees a friendly message.
    return "Бүртгэл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.";
  }
  if (key.includes("email") && key.includes("invalid")) {
    return "Имэйл хаяг буруу байна.";
  }
  if (key.includes("signups not allowed") || key.includes("signup_disabled")) {
    return "Шинэ бүртгэл хүлээж аваагүй байна. BDI-н ажилтантай холбогдоно уу.";
  }
  if (key === "missing-credentials" || key === "missing-fields") {
    return "Бүх талбарыг бөглөнө үү.";
  }
  if (key === "missing-email") {
    return "Имэйл хаягаа оруулна уу.";
  }
  if (key === "missing-password") {
    return "Нууц үгээ оруулна уу.";
  }
  if (key === "passwords-dont-match") {
    return "Нууц үг таарахгүй байна.";
  }
  if (key === "password-too-short") {
    return "Нууц үг доод тал нь 8 тэмдэгт байна.";
  }
  if (key === "missing-code") {
    return "Холбоос буруу эсвэл хугацаа дууссан байна.";
  }

  // Fallback — never echo raw Supabase messages to the user.
  return "Алдаа гарлаа. Дахин оролдоно уу.";
}
