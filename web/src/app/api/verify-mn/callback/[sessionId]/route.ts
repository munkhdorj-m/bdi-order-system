import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPhoneVerification } from "@/lib/sms/verify-mn";

/**
 * verify.mn callback endpoint.
 *
 * When the user sends the SMS to 144773 and verify.mn matches it to a
 * session, verify.mn fires a GET to this URL with no body and no
 * signature. Per the verify.mn spec:
 *
 *   "Treat this as a 'check now' notification — do NOT trust it on its
 *    own. On receiving the callback, look up the session, call
 *    GET /sessions/{sessionId}, mark verified."
 *
 * So we use the GET as a wake-up signal: pull the actual status from
 * verify.mn, and if VERIFIED, flip our DB row. Either way we return
 * 200 fast (verify.mn retries up to 5x on non-200, which would just
 * cause repeated re-checks).
 *
 * Anyone with the URL can hit this endpoint — that's fine because the
 * verification authority is verify.mn itself; this endpoint just polls
 * them. A malicious caller hitting it can't fake verification, only
 * cause us to re-check a session that's already PENDING.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  // verify.mn fires GET to the exact callback URL we gave it during
  // createSession. Since that URL has to be specified BEFORE we have
  // the sessionId, we use a single "noop" sentinel path. Recognize it
  // and skip — the client poller is the source of truth for status.
  if (sessionId === "noop" || sessionId === "placeholder") {
    return NextResponse.json({ ok: true });
  }

  // For per-session callback URLs (if we ever switch to a verify.mn
  // tier that supports them), treat as "check now" — pull verify.mn
  // status and flip our row if VERIFIED. Errors swallowed; the
  // client's poll endpoint retries on the next tick anyway.
  try {
    const status = await checkPhoneVerification(sessionId);
    if (status.sessionStatus === "VERIFIED") {
      const admin = createAdminClient();
      await admin
        .from("verify_mn_sessions")
        .update({ verified: true, verified_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("verified", false);
    }
  } catch (e) {
    console.error("[verify.mn callback] check failed:", e);
  }

  return NextResponse.json({ ok: true });
}
