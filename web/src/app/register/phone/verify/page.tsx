import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, MessageSquareText, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { VerifyMnPoller } from "@/components/buyer/verify-mn-poller";

type SearchParams = Promise<{
  session?: string;
  error?: string;
}>;

/**
 * verify.mn MO verification page.
 *
 * Shown after the user enters name + phone + password on /register/phone.
 * The flow from here is:
 *   1. We display the per-session 6-digit code + the smsUri tap-link.
 *   2. User taps "SMS илгээх" → SMS app opens pre-filled to send the
 *      code to shortcode 144773.
 *   3. <VerifyMnPoller> polls /api/verify-mn/poll/{sessionId} every
 *      ~3.5s. When the API reports verified=true, the poller submits
 *      completeVerification() which creates the Supabase auth user
 *      with phone+password and redirects to /login.
 *   4. If expiresAt passes without verification, poller redirects to
 *      /register/phone with an "expired" error so user can retry.
 */
export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session: sessionId, error } = await searchParams;

  if (!sessionId) redirect("/register/phone");

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("verify_mn_sessions")
    .select(
      "session_id, phone, code, sms_uri, display_instruction, verified, expires_at",
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!row) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Сесс олдсонгүй. Дахин эхлүүлнэ үү.")}`,
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h1 className="text-large-title">Утсаа баталгаажуул</h1>
          <p className="text-body text-muted-foreground mt-2">
            Доорх товчийг дарж SMS илгээгээрэй
          </p>
        </div>

        {/* Tap-target — opens the SMS app pre-filled with the code aimed
            at shortcode 144773. On desktop the link still works if a
            handler is registered; most desktop users will type the code
            manually using the code chip below. */}
        {row.sms_uri && (
          <a href={row.sms_uri} className="block btn-primary w-full text-center">
            <MessageSquareText className="inline h-4 w-4 mr-2" />
            SMS илгээх
          </a>
        )}

        {/* Manual fallback — for desktop or for users who'd rather open
            their SMS app themselves. */}
        <div className="mt-6 rounded-2xl bg-muted/50 ring-1 ring-border px-4 py-3 text-center">
          <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-1">
            Гар утаснаасаа илгээнэ үү
          </div>
          <div className="text-[13.5px] leading-snug">
            <span className="font-mono font-bold">144773</span> руу{" "}
            {row.code ? (
              <span className="font-mono font-bold text-primary text-[16px] tracking-wider">
                {row.code}
              </span>
            ) : (
              <span className="font-mono font-bold text-primary">
                {/* session-bound code */}
              </span>
            )}{" "}
            гэсэн мессеж илгээнэ үү.
          </div>
          {row.display_instruction && (
            <div className="text-[11px] text-muted-foreground mt-2">
              {row.display_instruction}
            </div>
          )}
        </div>

        {error && (
          <p
            className="mt-4 text-caption rounded-lg px-3 py-2 bg-destructive/10 text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Background poller — hits /api/verify-mn/poll/{sessionId} every
            3.5s. On verified, calls completeVerification (creates auth
            user + redirects to login). On expired, redirects back to
            /register/phone with an error. */}
        <VerifyMnPoller sessionId={sessionId} expiresAt={row.expires_at} />

        <div className="mt-6 space-y-3 text-center">
          <Link
            href={`/register/phone?phone=${encodeURIComponent(row.phone)}`}
            className="text-caption2 text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Дугаар засах / Шинээр эхлүүлэх
          </Link>
        </div>
      </div>
    </main>
  );
}
