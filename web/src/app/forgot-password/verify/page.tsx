import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronLeft, MessageSquareText, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { authMessage } from "@/lib/auth";
import { RESET_DRAFT_COOKIE, readResetDraft } from "@/lib/sms/draft-cookie";
import { localMnNumber } from "@/lib/sms/verify-mn";
import { VerifyMnPoller } from "@/components/buyer/verify-mn-poller";
import { completePasswordReset } from "../actions";

type SearchParams = Promise<{
  session?: string;
  error?: string;
}>;

/**
 * Forgot password — step 2: text the code from the registered phone.
 * Mirrors /register/phone/verify; the poller finishes the reset
 * (completePasswordReset) and lands the user on /login.
 */
export default async function ForgotPasswordVerifyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session: sessionId, error: errorCode } = await searchParams;
  const error = authMessage(errorCode);
  if (!sessionId) redirect("/forgot-password");

  // Only the browser that started this reset sees it (its code and phone).
  const draft = readResetDraft((await cookies()).get(RESET_DRAFT_COOKIE)?.value);
  if (draft?.sessionId !== sessionId) redirect("/forgot-password?error=session-missing");

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("verify_mn_sessions")
    .select("phone, purpose, code, sms_uri, display_instruction, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!row || row.purpose !== "password_reset") {
    redirect("/forgot-password?error=session-missing");
  }
  const localPhone = localMnNumber(String(row.phone));

  return (
    <main className="relative flex-1 min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 py-10 text-white bg-brand-gradient">
      <div
        className="absolute -top-32 -right-24 size-96 rounded-full bg-white/15 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-28 size-96 rounded-full bg-white/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative w-full max-w-sm page-enter">
        <div className="text-center mb-7">
          <div className="size-16 mx-auto rounded-[1.4rem] bg-white/15 backdrop-blur-md ring-1 ring-white/30 shadow-lg shadow-black/10 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8" strokeWidth={1.75} />
          </div>
          <h1 className="mt-5 text-[26px] font-bold tracking-tight leading-tight">
            Утсаа баталгаажуул
          </h1>
          <p className="mt-1.5 text-[14px] text-white/80">
            <span className="font-bold tabular-nums">{localPhone}</span> дугаартай утаснаасаа SMS
            илгээгээрэй
          </p>
        </div>

        <div className="rounded-[1.75rem] bg-card text-card-foreground shadow-2xl shadow-black/25 ring-1 ring-black/5 dark:ring-white/10 p-6">
          {row.sms_uri && (
            <a href={row.sms_uri} className="btn-primary w-full h-12 text-[15px]">
              <MessageSquareText className="h-4 w-4" />
              SMS илгээх
            </a>
          )}

          <div className="mt-4 rounded-2xl bg-muted/50 ring-1 ring-border px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-1">
              Гар утаснаасаа илгээнэ үү
            </div>
            <div className="text-[13.5px] leading-snug">
              <span className="font-mono font-bold">144773</span> руу{" "}
              <span className="font-mono font-bold text-primary text-[16px] tracking-wider">
                {row.code}
              </span>{" "}
              гэсэн мессеж илгээнэ үү.
            </div>
            {row.display_instruction && (
              <div className="text-[11px] text-muted-foreground mt-2">
                {row.display_instruction}
              </div>
            )}
          </div>

          <p className="mt-4 text-[12px] text-muted-foreground text-center leading-relaxed">
            Баталгаажмагц шинэ нууц үг тань хадгалагдаж, нэвтрэх хуудас руу шилжинэ.
          </p>

          {error && (
            <p
              className="mt-4 text-caption rounded-xl px-3 py-2 bg-destructive/10 text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <VerifyMnPoller
          sessionId={sessionId}
          expiresAt={row.expires_at}
          completeAction={completePasswordReset}
          restartHref="/forgot-password"
        />

        <div className="mt-6 text-center">
          <Link
            href={`/forgot-password?phone=${encodeURIComponent(localPhone)}`}
            className="text-[13px] text-white/80 inline-flex items-center gap-1.5 hover:text-white font-semibold"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Дугаар засах / Шинээр эхлүүлэх
          </Link>
        </div>
      </div>
    </main>
  );
}
