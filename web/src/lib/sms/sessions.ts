import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPhoneVerification } from "./verify-mn";

/**
 * Our side of a verify.mn check: the verify_mn_sessions row, the limit on
 * how often one phone / one network may start a check, and the one-time
 * "use" of a verified check. Shared by registration and password reset.
 */

export type SmsPurpose = "register" | "password_reset";

/** A used check is relabelled so its verified session can't be replayed. */
const DONE: Record<SmsPurpose, string> = {
  register: "register_done",
  password_reset: "password_reset_done",
};

/**
 * Checks allowed per window. Per phone keeps one number from being
 * spammed; per IP stops one sender from cycling through numbers. The IP
 * allowance is generous because Mongolian mobile networks put many phones
 * behind one address.
 */
const LIMIT_WINDOW_MS = 30 * 60 * 1000;
const MAX_PER_PHONE = 4;
const MAX_PER_IP = 20;

export type SmsSessionRow = {
  phone: string;
  purpose: string;
  verified: boolean;
  expires_at: string;
};

async function requestContext(): Promise<{ origin: string; ip: string | null }> {
  const h = await headers();
  // Vercel overwrites these with the real client address.
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  return { origin, ip: ip ? ip.slice(0, 64) : null };
}

async function overLimit(phone: string, ip: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - LIMIT_WINDOW_MS).toISOString();
  const [byPhone, byIp] = await Promise.all([
    admin
      .from("verify_mn_sessions")
      .select("session_id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", since),
    ip
      ? admin
          .from("verify_mn_sessions")
          .select("session_id", { count: "exact", head: true })
          .eq("requester_ip", ip)
          .gte("created_at", since)
      : null,
  ]);
  // A failed count never blocks a real user (fix 41 adds requester_ip;
  // until then the per-IP count errors and only the per-phone one applies).
  if (byPhone.error) {
    console.error("[sms] per-phone count failed:", byPhone.error.message);
  } else if ((byPhone.count ?? 0) >= MAX_PER_PHONE) {
    return true;
  }
  return Boolean(byIp && !byIp.error && (byIp.count ?? 0) >= MAX_PER_IP);
}

export type StartSmsResult =
  | { sessionId: string }
  | { error: "too-many-sms" | "sms-start-failed" };

/**
 * Open a verify.mn check for `phone` and record it. Answers the same way
 * whether or not the phone has an account — that is only revealed after
 * the owner has texted the code.
 */
export async function startSmsSession(
  phone: string,
  purpose: SmsPurpose,
): Promise<StartSmsResult> {
  const { origin, ip } = await requestContext();
  if (await overLimit(phone, ip)) return { error: "too-many-sms" };

  let session;
  try {
    session = await createPhoneVerification({
      phone,
      // verify.mn needs a callback, but it is only a no-op ack: the poll
      // route (which carries the user's sealed cookie) is the source of truth.
      callbackUrl: `${origin}/api/verify-mn/callback/noop`,
    });
  } catch (e) {
    console.error(
      `[sms] createPhoneVerification (${purpose}) failed:`,
      e instanceof Error ? e.message : e,
    );
    return { error: "sms-start-failed" };
  }

  const admin = createAdminClient();
  const row = {
    session_id: session.sessionId,
    phone,
    purpose,
    code: session.text,
    sms_uri: session.smsUri,
    display_instruction: session.displayInstruction,
    verified: false,
    expires_at: session.expiresAt,
  };
  let { error } = await admin
    .from("verify_mn_sessions")
    .insert({ ...row, requester_ip: ip });
  if (error && /requester_ip/.test(error.message)) {
    // Fix 41 not run yet — store the check without the address.
    ({ error } = await admin.from("verify_mn_sessions").insert(row));
  }
  if (error) {
    console.error(`[sms] verify_mn_sessions insert (${purpose}) failed:`, error.message);
    return { error: "sms-start-failed" };
  }
  return { sessionId: session.sessionId };
}

export async function loadSmsSession(sessionId: string): Promise<SmsSessionRow | null> {
  const { data, error } = await createAdminClient()
    .from("verify_mn_sessions")
    .select("phone, purpose, verified, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) {
    console.error("[sms] session read failed:", error.message);
    return null;
  }
  return (data as SmsSessionRow | null) ?? null;
}

/**
 * Use a verified check — exactly once. One UPDATE … WHERE purpose = <open>
 * RETURNING: of two callers racing, only one gets the row back.
 * False when it isn't verified, belongs to another phone or purpose, or
 * was already used.
 */
export async function claimVerifiedSession(
  sessionId: string,
  phone: string,
  purpose: SmsPurpose,
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("verify_mn_sessions")
    .update({ purpose: DONE[purpose] })
    .eq("session_id", sessionId)
    .eq("purpose", purpose)
    .eq("phone", phone)
    .eq("verified", true)
    .select("session_id");
  if (error) {
    console.error("[sms] claim failed:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** Undo a claim when the step after it failed, so the user can retry without a new SMS. */
export async function releaseSession(sessionId: string, purpose: SmsPurpose): Promise<void> {
  const { error } = await createAdminClient()
    .from("verify_mn_sessions")
    .update({ purpose })
    .eq("session_id", sessionId)
    .eq("purpose", DONE[purpose]);
  if (error) console.error("[sms] release failed:", error.message);
}

/** Done purposes count as "this purpose" when checking a draft against its session. */
export function isPurpose(rowPurpose: string, purpose: SmsPurpose): boolean {
  return rowPurpose === purpose || rowPurpose === DONE[purpose];
}
