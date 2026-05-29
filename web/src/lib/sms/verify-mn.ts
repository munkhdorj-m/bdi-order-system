// Server-only verify.mn client.
//
// verify.mn is a Mongolia-only Mobile-Originated (MO) SMS verification
// gateway. The flow is the inverse of typical OTP:
//   - WE create a session (random 6-digit code per session).
//   - The USER sends that code FROM their phone TO shortcode 144773.
//   - verify.mn matches the incoming SMS body to the session and
//     fires a callback to us when matched.
//   - We confirm by polling GET /sessions/{sessionId} for sessionStatus
//     === "VERIFIED".
//
// This module exposes two functions:
//   - createPhoneVerification(phone, callbackUrl) — kicks off a session
//   - checkPhoneVerification(sessionId)           — polls current state
//
// A single async `verifyPhone(phone): Promise<boolean>` is intentionally
// NOT exposed: verification takes 10–300 seconds (user has to tap+send
// the SMS), which is longer than serverless function timeouts. The
// caller drives polling from the client.

import "server-only";
import { randomInt } from "node:crypto";

const API_BASE = "https://api.verify.mn";
const SHORTCODE = "144773";

/** verify.mn rejects polls faster than 2s on the same sessionId. We
 *  use 3s as the floor with a small safety margin. */
export const VERIFY_MN_MIN_POLL_MS = 3000;

export type VerifyMnSession = {
  sessionId: string;
  phone: string;
  shortcode: string;
  /** The text the user must send TO `shortcode` — the random per-session
   *  code we generated. */
  text: string;
  /** sms:144773?body=... — tap-target on mobile to pre-fill the SMS app. */
  smsUri: string;
  /** Mongolian-language instructions to display to the user. */
  displayInstruction: string;
  /** ISO timestamp. After this, sessionStatus flips to EXPIRED. */
  expiresAt: string;
};

export type VerifyMnStatus = {
  sessionId: string;
  phone: string;
  sessionStatus: "PENDING" | "VERIFIED" | "EXPIRED";
  callbackStatus: "PENDING" | "SENT" | "FAILED";
  verifiedAt: string | null;
  expiresAt: string;
};

function requireApiKey(): string {
  const k = process.env.VERIFY_MN_API_KEY;
  if (!k || k.trim() === "") {
    throw new Error(
      "VERIFY_MN_API_KEY is not set. Get one from the verify.mn dashboard and add it to your env vars.",
    );
  }
  return k;
}

/** Cryptographically random 6-digit numeric code, zero-padded. Used as
 *  the SMS body the user sends — must be unique per session so verify.mn
 *  can correlate the incoming SMS to the right session. */
function generateSessionCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Create a verify.mn session for `phone`. Returns the session metadata
 * including the smsUri (use as a mobile tap-link) and the Mongolian
 * displayInstruction to show alongside.
 *
 * `callbackUrl` is the public URL verify.mn will GET when the user's
 * SMS lands. It must be HTTPS. Pass the full absolute URL including
 * sessionId-bearing path so the callback route can identify which
 * session was completed.
 */
export async function createPhoneVerification(args: {
  phone: string;
  callbackUrl: string;
}): Promise<VerifyMnSession> {
  const code = generateSessionCode();

  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: args.phone,
      text: code,
      callback: args.callbackUrl,
    }),
    // No keepalive — server actions own the request lifecycle.
  });

  if (res.status === 401) {
    // Server log only — never echo the key. Caller surfaces a generic
    // message to the user.
    console.error("[verify.mn] 401 unauthorized — VERIFY_MN_API_KEY rejected");
    throw new Error("verify.mn auth failed");
  }
  if (res.status === 400) {
    const body = await safeText(res);
    throw new Error(`verify.mn validation: ${body}`);
  }
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(`verify.mn createSession ${res.status}: ${body}`);
  }

  const json = (await res.json()) as Partial<VerifyMnSession> & {
    sessionId: string;
  };

  // Defensive: verify.mn should return these but make the contract
  // explicit so a future API drift fails loudly.
  if (
    !json.sessionId ||
    !json.smsUri ||
    !json.displayInstruction ||
    !json.expiresAt
  ) {
    throw new Error("verify.mn createSession response missing required fields");
  }

  return {
    sessionId: json.sessionId,
    phone: json.phone ?? args.phone,
    shortcode: json.shortcode ?? SHORTCODE,
    text: json.text ?? code,
    smsUri: json.smsUri,
    displayInstruction: json.displayInstruction,
    expiresAt: json.expiresAt,
  };
}

/**
 * Check the current status of a verify.mn session. No auth required.
 * Caller must enforce the 3s minimum polling interval per sessionId —
 * faster gets 429. We don't retry on 429 here; we surface it so the
 * caller can back off appropriately.
 */
export async function checkPhoneVerification(
  sessionId: string,
): Promise<VerifyMnStatus> {
  const res = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}`,
  );

  if (res.status === 404) {
    throw new Error(`verify.mn session not found: ${sessionId}`);
  }
  if (res.status === 429) {
    throw new Error(
      `verify.mn rate-limited (429) — wait at least ${VERIFY_MN_MIN_POLL_MS}ms between polls`,
    );
  }
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(`verify.mn checkSession ${res.status}: ${body}`);
  }

  return (await res.json()) as VerifyMnStatus;
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return "<no body>";
  }
}

/**
 * Loose normalizer for Mongolian phone numbers entered without country
 * code. Accepts:
 *   - "99112233"            → "+97699112233"
 *   - "+97699112233"        → "+97699112233"
 *   - "976 99 11 22 33"     → "+97699112233"
 *   - "(+976) 9911-2233"    → "+97699112233"
 *
 * Returns null for anything that doesn't look like an 8-digit MN mobile.
 * Lives in this module (rather than its own file) so the entire phone-
 * verification surface area is in one place.
 */
export function normalizeMnPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const noPlus = digits.startsWith("+") ? digits.slice(1) : digits;
  const local = noPlus.startsWith("976") ? noPlus.slice(3) : noPlus;
  if (!/^[6789]\d{7}$/.test(local)) return null;
  return `+976${local}`;
}
