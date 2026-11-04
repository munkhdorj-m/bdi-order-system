"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

type Result = { ok?: boolean; error?: string };

/**
 * Mark a single notification as read. RLS scopes this to rows owned by
 * the current user, so a buyer can never flip another user's row.
 */
export async function markNotificationRead(id: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

/** Mark every unread notification for the current user as read. */
export async function markAllNotificationsRead(): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.userId)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

/* ============================================================
 * Web Push subscription management
 * ============================================================
 * The browser mints a PushSubscription object once the user grants
 * notification permission; these two actions persist and remove it.
 * The service-role send path in lib/push.ts reads these rows.
 */

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Store (or refresh) the calling user's push subscription.
 *
 * Called on every app load once permission is granted, not just the
 * first time — browsers silently rotate endpoints, and a stale row
 * means a device that stops receiving alerts without anyone noticing.
 * `endpoint` is unique, so the upsert refreshes in place rather than
 * accumulating a row per app open.
 */
export async function savePushSubscription(
  sub: PushSubscriptionInput,
  userAgent?: string,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };

  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
    return { error: "Захиалга дутуу байна." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: userAgent?.slice(0, 400) ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Forget a subscription — called when the user turns notifications off.
 * RLS scopes the delete to their own rows, so passing someone else's
 * endpoint is a no-op rather than a way to silence another admin.
 */
export async function deletePushSubscription(
  endpoint: string,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };
  if (!endpoint) return { error: "Endpoint байхгүй." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return { error: error.message };
  return { ok: true };
}
