/**
 * In-app notification helpers — fan out notifications.
 *
 * Uses the admin (service role) Supabase client so a single buyer's
 * placeOrder action can write a row to every admin's notification
 * feed without RLS gymnastics.
 *
 * All functions swallow errors and log to console. A notification
 * failing must never break the user action that triggered it.
 */

import { createAdminClient } from "./supabase/admin";

export type NotificationKind =
  | "order_new"
  | "order_status"
  | "user_approved"
  | "discount_new";

export type NotificationInsert = {
  user_id: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  order_id?: string | null;
  discount_id?: string | null;
};

/** Insert a single notification row. */
export async function notify(row: NotificationInsert): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(row);
    if (error) console.error("notify failed:", error.message);
  } catch (e) {
    console.error("notify threw:", e);
  }
}

/** Insert one row per recipient. Skips if recipients is empty. */
export async function notifyMany(
  recipients: string[],
  template: Omit<NotificationInsert, "user_id">,
): Promise<void> {
  if (recipients.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = recipients.map((user_id) => ({ user_id, ...template }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.error("notifyMany failed:", error.message);
  } catch (e) {
    console.error("notifyMany threw:", e);
  }
}

/** Helper: every admin user id. Used to fan out new-order notifications. */
export async function listAdminIds(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("active", true);
    if (error) {
      console.error("listAdminIds failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => r.id as string);
  } catch (e) {
    console.error("listAdminIds threw:", e);
    return [];
  }
}

/** Helper: every active buyer user id. Used for discount broadcasts. */
export async function listBuyerIds(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "buyer")
      .eq("active", true);
    if (error) {
      console.error("listBuyerIds failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => r.id as string);
  } catch (e) {
    console.error("listBuyerIds threw:", e);
    return [];
  }
}
