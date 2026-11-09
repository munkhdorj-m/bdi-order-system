import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VERIFY_MN_MIN_POLL_MS,
  checkPhoneVerification,
} from "@/lib/sms/verify-mn";
import {
  REGISTER_DRAFT_COOKIE,
  RESET_DRAFT_COOKIE,
  readRegisterDraft,
  readResetDraft,
  type RegisterDraft,
} from "@/lib/sms/draft-cookie";
import { finalizeRegistration } from "@/lib/register-finalize";

/**
 * Create the account NOW, server-side, the moment verify.mn confirms —
 * instead of waiting for the client poller to run completeVerification.
 * This survives the user closing the tab right after texting. Idempotent
 * and best-effort: completeVerification is still the backup.
 */
async function finalize(draft: RegisterDraft): Promise<void> {
  try {
    const result = await finalizeRegistration(draft);
    if (result.status === "error") {
      console.error("[verify.mn poll] server-side finalize failed:", result.message);
    }
  } catch (e) {
    console.error("[verify.mn poll] finalize threw:", e);
  }
}

/**
 * Client-driven polling for one verify.mn check. Only the browser that
 * started the check may poll it: it must carry the sealed registration or
 * reset draft for this exact session id. Anyone else gets 404 — so the
 * route can't be used to make us call verify.mn for sessions that aren't
 * theirs, or to learn a session's state.
 *
 *   1. Read our own row (cheap).
 *   2. Already verified → answer at once (and finish a registration).
 *   3. Past expires_at → expired.
 *   4. Otherwise ask verify.mn; on VERIFIED flip our row.
 *
 * The browser paces itself (≥ 3.5 s, VERIFY_MN_MIN_POLL_MS on a 429).
 *
 * Response: { verified, expired, sessionStatus, retryAfterMs? }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const store = await cookies();
  const registerDraft = readRegisterDraft(store.get(REGISTER_DRAFT_COOKIE)?.value);
  const resetDraft = readResetDraft(store.get(RESET_DRAFT_COOKIE)?.value);
  const ownRegistration = registerDraft?.sessionId === sessionId ? registerDraft : null;
  if (!ownRegistration && resetDraft?.sessionId !== sessionId) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: row, error: rowErr } = await admin
    .from("verify_mn_sessions")
    .select("session_id, verified, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (rowErr) {
    console.error("[verify.mn poll] db read failed:", rowErr.message);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  // Already verified by an earlier tick. Still attempt finalize (idempotent):
  // recovers the account if that tick flipped `verified` but didn't finish.
  if (row.verified) {
    if (ownRegistration) await finalize(ownRegistration);
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

  try {
    const status = await checkPhoneVerification(sessionId);
    if (status.sessionStatus === "VERIFIED") {
      await admin
        .from("verify_mn_sessions")
        .update({ verified: true, verified_at: new Date().toISOString() })
        .eq("session_id", sessionId);
      // Create the account right now, while we have the user's cookie.
      if (ownRegistration) await finalize(ownRegistration);
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
      // Usually two polls at once; tell the browser to back off.
      return NextResponse.json({
        verified: false,
        expired: false,
        sessionStatus: "PENDING",
        retryAfterMs: VERIFY_MN_MIN_POLL_MS,
      });
    }
    console.error("[verify.mn poll] check failed:", msg);
    return NextResponse.json({ error: "verify.mn check failed" }, { status: 502 });
  }
}
