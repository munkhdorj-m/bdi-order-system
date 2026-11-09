"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { PUSH_DEVICE_COOKIE, isPushEndpoint } from "@/lib/push";

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
  revalidatePath("/", "layout"); // every bell in every area
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
  revalidatePath("/", "layout"); // every bell in every area
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

/** Devices kept per user; the least recently seen beyond this are dropped. */
const MAX_DEVICES_PER_USER = 10;
/** base64url keys: p256dh is 65 bytes (87 chars), auth 16 bytes (22 chars). */
const KEY_RE = /^[A-Za-z0-9_-]{16,200}={0,2}$/;

/**
 * Store (or refresh) the calling user's push subscription.
 *
 * Called on every app load once permission is granted, not just the
 * first time — browsers silently rotate endpoints, and a stale row
 * means a device that stops receiving alerts without anyone noticing.
 *
 * A device belongs to whoever is signed in on it NOW: if the endpoint is
 * still stored for the previous user (a shared shop tablet), it moves to
 * this user. Before, that save was refused silently and the device kept
 * getting the previous user's — possibly an admin's — alerts.
 */
export async function savePushSubscription(
  sub: PushSubscriptionInput,
  userAgent?: string,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: "Нэвтрэлт хэрэгтэй." };

  if (
    !sub ||
    !isPushEndpoint(sub.endpoint) ||
    typeof sub.p256dh !== "string" ||
    typeof sub.auth !== "string" ||
    !KEY_RE.test(sub.p256dh) ||
    !KEY_RE.test(sub.auth)
  ) {
    return { error: "Энэ төхөөрөмжийн мэдэгдлийн тохиргоо буруу байна." };
  }

  // Service role: the row may still belong to the previous user of this
  // device. user_id always comes from the verified session, never the client.
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: session.userId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        user_agent: typeof userAgent === "string" ? userAgent.slice(0, 400) : null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single();
  if (error || !row) {
    console.error("[push] save subscription failed:", error?.message);
    return { error: "Мэдэгдэл хадгалж чадсангүй. Дахин оролдоно уу." };
  }

  // Cap devices per user: forget the ones not seen for longest.
  const { data: extra } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", session.userId)
    .order("last_seen_at", { ascending: false })
    .range(MAX_DEVICES_PER_USER, MAX_DEVICES_PER_USER + 100);
  if (extra && extra.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", extra.map((r) => r.id as string));
  }

  // Remember which row is this device, so sign-out can remove it.
  (await cookies()).set(PUSH_DEVICE_COOKIE, row.id as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 60 * 60,
  });
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
  if (typeof endpoint !== "string" || !endpoint) return { error: "Endpoint байхгүй." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return { error: error.message };
  (await cookies()).delete(PUSH_DEVICE_COOKIE);
  return { ok: true };
}
