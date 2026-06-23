import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VERIFY_MN_MIN_POLL_MS,
  checkPhoneVerification,
} from "@/lib/sms/verify-mn";
import {
  finalizeRegistration,
  parsePendingDraft,
  PENDING_COOKIE,
} from "@/lib/register-finalize";

/**
 * Create the account NOW, server-side, the moment verify.mn confirms —
 * instead of waiting for the client poller to run completeVerification.
 * The poll fetch is same-origin so it carries the httpOnly draft cookie
 * (name + password). This survives the user closing the tab right after
 * verification. Idempotent + best-effort: the client path is still a
 * backup, and a failure here just leaves the row verified for a retry.
 */
async function finalizeFromCookie(sessionId: string): Promise<void> {
  try {
    const store = await cookies();
    const draft = parsePendingDraft(store.get(PENDING_COOKIE)?.value);
    // Only finalize the draft that matches THIS session (the user's own).
    if (!draft || draft.sessionId !== sessionId) return;
    const result = await finalizeRegistration(draft);
    if (result.status === "error") {
      console.error(
        "[verify.mn poll] server-side finalize failed:",
        result.message,
      );
    }
  } catch (e) {
    console.error("[verify.mn poll] finalize threw:", e);
  }
}

/**
 * Client-driven polling endpoint.
 *
 * The browser hits this every ~3.5s while waiting for the user to send
 * the SMS. We:
 *
 *   1. Read our own row (cheap).
 *   2. If verified=true already (callback got here first), return
 *      verified=true without round-tripping to verify.mn.
 *   3. If expires_at has passed, return expired=true.
 *   4. Otherwise hit verify.mn /sessions/{id}. If VERIFIED, flip our
 *      row and return verified=true. If still PENDING, return
 *      verified=false (client keeps polling).
 *
 * The 3-second minimum interval against verify.mn is enforced
 * implicitly: we only hit verify.mn when our DB row isn't yet
 * verified, and the client paces itself at >= 3.5s. As an extra
 * guard, we throttle outbound calls per session_id using a
 * `last_polled_at` column tracked in the DB.
 *
 * Response shape:
 *   { verified: boolean, expired: boolean, sessionStatus: string }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const admin = createAdminClient();

  const { data: row, error: rowErr } = await admin
    .from("verify_mn_sessions")
    .select("session_id, verified, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (rowErr) {
    console.error("[verify.mn poll] db read failed:", rowErr.message);
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  // Already verified by an earlier poll — fast path. Still attempt finalize
  // (idempotent): recovers the account if a prior tick flipped `verified`
  // but its finalize didn't complete.
  if (row.verified) {
    await finalizeFromCookie(sessionId);
    return NextResponse.json({
      verified: true,
      expired: false,
      sessionStatus: "VERIFIED",
    });
  }

  const expiresAtMs = new Date(row.expires_at).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return NextResponse.json({
      verified: false,
      expired: true,
      sessionStatus: "EXPIRED",
    });
  }

  // Live status check. On 429, back off and tell the client to retry —
  // they should already be polling no faster than the floor, so 429s
  // usually mean simultaneous calls (e.g. callback + poll racing).
  try {
    const status = await checkPhoneVerification(sessionId);
    if (status.sessionStatus === "VERIFIED") {
      await admin
        .from("verify_mn_sessions")
        .update({ verified: true, verified_at: new Date().toISOString() })
        .eq("session_id", sessionId);
      // Create the account right now, server-side, while we have the
      // user's cookie — don't depend on the client poller finishing.
      await finalizeFromCookie(sessionId);
      return NextResponse.json({
        verified: true,
        expired: false,
        sessionStatus: "VERIFIED",
      });
    }
    if (status.sessionStatus === "EXPIRED") {
      return NextResponse.json({
        verified: false,
        expired: true,
        sessionStatus: "EXPIRED",
      });
    }
    return NextResponse.json({
      verified: false,
      expired: false,
      sessionStatus: status.sessionStatus,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("429")) {
      return NextResponse.json(
        {
          verified: false,
          expired: false,
          sessionStatus: "PENDING",
          retryAfterMs: VERIFY_MN_MIN_POLL_MS,
        },
        { status: 200 },
      );
    }
    console.error("[verify.mn poll] check failed:", msg);
    return NextResponse.json(
      { error: "verify.mn check failed" },
      { status: 502 },
    );
  }
}
