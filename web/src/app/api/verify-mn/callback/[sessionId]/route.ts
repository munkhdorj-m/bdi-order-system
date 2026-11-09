import { NextResponse } from "next/server";

/**
 * verify.mn callback endpoint — an acknowledgement only.
 *
 * verify.mn fires an unsigned GET here when a user's SMS lands. We only
 * ever hand it the fixed `/api/verify-mn/callback/noop` URL (the session id
 * isn't known when the URL is chosen), and verify.mn's own guidance is not
 * to trust the ping. The browser's poll route — which carries the user's
 * sealed draft cookie — is the source of truth for verification.
 *
 * So whatever path segment arrives, nothing is looked up and nothing is
 * changed: an anonymous caller can't make us call verify.mn or touch the
 * database. Always 200, or verify.mn retries up to 5 times.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
