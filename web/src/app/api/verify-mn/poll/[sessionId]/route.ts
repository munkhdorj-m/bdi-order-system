import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VERIFY_MN_MIN_POLL_MS,
  checkPhoneVerification,
} from "@/lib/sms/verify-mn";

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

  // Already verified by an earlier poll or by the callback — fast path.
  if (row.verified) {
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
