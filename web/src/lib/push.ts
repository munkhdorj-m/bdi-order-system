import "server-only";
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

/**
 * Web Push (VAPID) delivery — the free, self-hosted half of the admin
 * alerting stack.
 *
 * No third party, no per-message cost, no quota: we sign each push with
 * our own VAPID keypair and hand it to whatever push service the
 * browser chose (FCM for Chrome/Android, Apple for iOS Safari, Mozilla
 * autopush for Firefox). Payloads are end-to-end encrypted with the
 * subscription's own p256dh/auth keys, so the push service relays
 * ciphertext it cannot read.
 *
 * Device support, since it decides what admins must do once:
 *   - Android Chrome  — works as soon as permission is granted.
 *   - Desktop Chrome/Edge/Firefox — same, shows as a Windows toast.
 *   - iOS Safari 16.4+ — ONLY after the site is added to the Home
 *     Screen. A plain Safari tab can't subscribe at all; the UI in
 *     push-toggle.tsx detects this and explains the install step.
 *
 * Every function here swallows its errors. A failed push must never
 * break the order or registration that triggered it.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
/* mailto: contact the push service uses to reach us about problems. */
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@bdi.mn";

/** True when VAPID keys are configured — otherwise push is a no-op. */
export function pushConfigured(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (!pushConfigured()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
    vapidReady = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body?: string | null;
  /** In-app path the notification opens when tapped. */
  href?: string | null;
  /**
   * Collapse key. Two pushes with the same tag replace each other in
   * the tray instead of stacking — we pass the notification kind so a
   * burst of new orders doesn't bury the phone in 30 separate toasts.
   */
  tag?: string;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Push to every device belonging to the given users.
 *
 * Subscriptions die naturally — the user clears site data, uninstalls
 * the PWA, or the browser rotates the endpoint. The push service
 * reports that as 404/410 Gone, and we delete the row on the spot so
 * the table stays clean without a cron job.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (userIds.length === 0) return;
  if (!ensureVapid()) return;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (error) {
      console.error("sendPushToUsers: load subs failed:", error.message);
      return;
    }
    const subs = (data ?? []) as SubRow[];
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      href: payload.href ?? "/",
      tag: payload.tag ?? "bdi",
    });

    const dead: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            body,
            {
              // Ask the push service to hold the message for 24h if the
              // device is offline (phone in a pocket with no signal).
              TTL: 60 * 60 * 24,
              urgency: "high",
            },
          );
        } catch (e) {
          const status = (e as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            dead.push(s.id);
          } else {
            console.error("push send failed:", status, (e as Error)?.message);
          }
        }
      }),
    );

    if (dead.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", dead);
    }
  } catch (e) {
    console.error("sendPushToUsers threw:", e);
  }
}
