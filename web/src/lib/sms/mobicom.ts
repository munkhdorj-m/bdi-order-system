// Server-only Mobicom SMS gateway client.
//
// Mobicom (Монгол улсын Mobicom Corporation) doesn't publish their SMS API
// publicly the way Twilio or MessageBird do — you have to sign a business
// SMS-sender contract with them, then they give you:
//   - An API endpoint URL (HTTPS)
//   - A username / API key (sometimes called "Login" + "Password")
//   - An approved sender ID (alphanumeric, usually your brand name)
//
// Until those land, this client throws a clear error so dev sees the
// missing config instead of a silent SMS-not-sent surprise.
//
// To wire it up:
//   1. Set MOBICOM_API_URL, MOBICOM_API_USER, MOBICOM_API_KEY,
//      MOBICOM_SENDER in .env.local
//   2. Replace the `TODO: real Mobicom request` block below with whatever
//      shape Mobicom's docs spec (most operators use either a GET with
//      query-string args, or a POST with form/JSON body)
//   3. Mirror status-code → boolean mapping so callers can react to
//      delivery success/failure.
//
// We treat phone numbers as already normalized E.164 (+976XXXXXXXX) here —
// normalization happens in the calling action.
import "server-only";

type Env = {
  url: string;
  user: string;
  key: string;
  sender: string;
};

function readEnv(): Env | null {
  const url = process.env.MOBICOM_API_URL;
  const user = process.env.MOBICOM_API_USER;
  const key = process.env.MOBICOM_API_KEY;
  const sender = process.env.MOBICOM_SENDER;
  if (!url || !user || !key || !sender) return null;
  return { url, user, key, sender };
}

export type SendSmsResult =
  | { ok: true; provider_message_id?: string }
  | { ok: false; error: string };

/**
 * Send a single SMS via Mobicom. Returns ok:false instead of throwing so
 * callers can decide whether to surface the failure to the user or just
 * log it.
 *
 * In dev (no Mobicom env vars set), logs the message to the server console
 * and returns ok:true so the OTP flow is still walkable end-to-end.
 */
export async function sendSms(args: {
  to: string; // E.164, e.g. +97699112233
  text: string;
}): Promise<SendSmsResult> {
  const env = readEnv();

  if (!env) {
    // Dev fallback — log to server console and pretend it worked so the
    // verify step can still happen with whatever code the action printed.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[sms.mobicom] MOBICOM_* env vars not set — printing SMS instead of sending.\n",
        `  to:   ${args.to}\n`,
        `  text: ${args.text}`,
      );
      return { ok: true };
    }
    return {
      ok: false,
      error:
        "SMS-ийн тохиргоо хийгдээгүй байна. Та админд хандана уу.",
    };
  }

  try {
    // TODO: replace the placeholder request below with the real Mobicom
    // call once we have their API docs. The pattern I'm using assumes:
    //   - HTTPS POST application/x-www-form-urlencoded
    //   - body params: user, key, from, to, text
    //   - response body: "OK" or "OK;<message_id>" on success, an error
    //     code otherwise
    // Adjust to match whatever Mobicom actually expects.
    const body = new URLSearchParams({
      user: env.user,
      key: env.key,
      from: env.sender,
      to: args.to,
      text: args.text,
    });

    const res = await fetch(env.url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      // No keepalive — SMS sends from server actions, where the
      // request lifecycle wraps the fetch already.
    });

    const responseText = (await res.text()).trim();

    if (!res.ok) {
      return {
        ok: false,
        error: `Mobicom HTTP ${res.status}: ${responseText.slice(0, 200)}`,
      };
    }

    // Most gateways return "OK" (or similar) prefix on success. Adapt
    // this check once you have a real response sample.
    if (!responseText.toUpperCase().startsWith("OK")) {
      return { ok: false, error: `Mobicom rejected: ${responseText.slice(0, 200)}` };
    }

    const semi = responseText.indexOf(";");
    return {
      ok: true,
      provider_message_id: semi > 0 ? responseText.slice(semi + 1) : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
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
 */
export function normalizeMnPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  // Strip a leading +
  const noPlus = digits.startsWith("+") ? digits.slice(1) : digits;
  // If they typed the country code, strip it. Otherwise it should be 8 digits.
  const local = noPlus.startsWith("976") ? noPlus.slice(3) : noPlus;
  // MN mobiles are 8 digits starting with 6/7/8/9.
  if (!/^[6789]\d{7}$/.test(local)) return null;
  return `+976${local}`;
}
