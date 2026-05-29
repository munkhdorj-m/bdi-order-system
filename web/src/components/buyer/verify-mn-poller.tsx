"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { completeVerification } from "@/app/register/phone/actions";

/**
 * Background poller for verify.mn MO verification.
 *
 * Hits /api/verify-mn/poll/{sessionId} every POLL_INTERVAL_MS (a hair
 * over verify.mn's 3-second floor). On verified=true, calls the server
 * action `completeVerification` which creates the Supabase auth user
 * with the cookie-stashed name + password and redirects to /login. On
 * expired=true, redirects back to the phone-entry page with an error.
 *
 * The poll endpoint is the one rate-limit-aware proxy in front of
 * verify.mn — we never call verify.mn directly from the client.
 */
const POLL_INTERVAL_MS = 3500;

export function VerifyMnPoller({
  sessionId,
  expiresAt,
}: {
  sessionId: string;
  expiresAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "polling" | "verified" | "expired" | "error"
  >("polling");
  // Latch so completeVerification fires exactly once even if the poll
  // tick races with the redirect.
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled || completedRef.current) return;

      // Hard timeout — if we somehow keep polling past expiry, give up.
      if (Date.now() > new Date(expiresAt).getTime()) {
        setStatus("expired");
        router.replace(
          `/register/phone?error=${encodeURIComponent("Сессийн хугацаа дууссан. Дахин эхлүүлнэ үү.")}`,
        );
        return;
      }

      try {
        const res = await fetch(
          `/api/verify-mn/poll/${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        const data = (await res.json()) as {
          verified?: boolean;
          expired?: boolean;
          retryAfterMs?: number;
        };

        if (data.verified) {
          completedRef.current = true;
          setStatus("verified");
          // Server action handles the redirect to /login (or back to
          // /register/phone with an error if the createUser failed).
          startTransition(async () => {
            await completeVerification();
          });
          return;
        }
        if (data.expired) {
          setStatus("expired");
          router.replace(
            `/register/phone?error=${encodeURIComponent("Сессийн хугацаа дууссан. Дахин эхлүүлнэ үү.")}`,
          );
          return;
        }

        // Still PENDING — schedule the next tick. Honor any
        // retryAfterMs hint the API surfaces (used when verify.mn
        // returned 429).
        const nextMs = Math.max(
          POLL_INTERVAL_MS,
          data.retryAfterMs ?? POLL_INTERVAL_MS,
        );
        timer = setTimeout(tick, nextMs);
      } catch (e) {
        if (cancelled) return;
        console.error("[verify.mn poller] fetch failed:", e);
        // Network blip — retry on the same cadence. Surface a soft
        // status hint but don't break the loop.
        setStatus("error");
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    // Kick off immediately so the user sees a fresh check on first paint,
    // then the interval takes over.
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, expiresAt, router]);

  return (
    <div
      className="mt-5 flex items-center justify-center gap-2 text-[12px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} />
      {status === "verified" || pending
        ? "Баталгаажлаа — үргэлжлүүлж байна..."
        : status === "expired"
          ? "Сессийн хугацаа дууссан"
          : status === "error"
            ? "Сүлжээний алдаа — дахин шалгаж байна"
            : "Таны мессежийг хүлээж байна..."}
    </div>
  );
}
