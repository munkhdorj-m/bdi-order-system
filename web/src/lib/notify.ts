/**
 * Notification fan-out — one call, three delivery channels.
 *
 * Every notification in the app funnels through notify() / notifyMany(),
 * which is why device push could be added without touching a single
 * call site's logic:
 *
 *   1. In-app feed  — a `notifications` row per recipient, surfaced by
 *                     the header bell. Always written.
 *   2. Web Push     — a real OS notification on every device the
 *                     recipient has enabled. Free, unlimited, no third
 *                     party. On by default; pass `push: false` to skip.
 *   3. Telegram     — a message to the shared BDI staff chat. Opt-IN
 *                     per call (`telegram: true`) because it's a single
 *                     shared channel, not a per-user inbox — only
 *                     admin-facing events belong there.
 *
 * Uses the admin (service role) Supabase client so a single buyer's
 * placeOrder action can write to every admin's feed and read every
 * admin's push subscriptions without RLS gymnastics.
 *
 * All functions swallow errors and log to console. A notification
 * failing must never break the user action that triggered it.
 */

import { createAdminClient } from "./supabase/admin";
import { fetchAll } from "./supabase/fetch-all";
import { sendPushToUsers } from "./push";
import { sendTelegram } from "./telegram";

/** Rows per notifications insert — keeps one broadcast from becoming one giant request. */
const INSERT_CHUNK = 500;

export type NotificationKind =
  | "order_new"
  | "order_status"
  | "order_cancelled"
  | "user_approved"
  | "user_pending"
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

export type NotifyOptions = {
  /** Send an OS-level push to the recipient's devices. Default true. */
  push?: boolean;
  /** Also post to the shared BDI staff Telegram chat. Default false. */
  telegram?: boolean;
};

/** Emoji prefix per kind, so the Telegram chat is triageable at a glance. */
const KIND_EMOJI: Record<NotificationKind, string> = {
  order_new: "🛒",
  order_status: "📦",
  order_cancelled: "❌",
  user_approved: "✅",
  user_pending: "👤",
  discount_new: "🎁",
};

/** Label for the Telegram button that opens the related admin page. */
const KIND_BUTTON: Record<NotificationKind, string> = {
  order_new: "Захиалга харах",
  order_status: "Захиалга харах",
  order_cancelled: "Захиалга харах",
  user_approved: "Хэрэглэгч харах",
  user_pending: "Хэрэглэгч харах",
  discount_new: "Хямдрал харах",
};

/** Insert a single notification row + deliver on the enabled channels. */
export async function notify(
  row: NotificationInsert,
  options: NotifyOptions = {},
): Promise<void> {
  const { push = true, telegram = false } = options;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(row);
    if (error) console.error("notify failed:", error.message);
  } catch (e) {
    console.error("notify threw:", e);
  }

  if (push) {
    await sendPushToUsers([row.user_id], {
      title: row.title,
      body: row.body,
      href: row.href,
      tag: row.kind,
    });
  }

  if (telegram) {
    await sendTelegram({
      title: row.title,
      body: row.body,
      href: row.href,
      buttonText: KIND_BUTTON[row.kind],
      emoji: KIND_EMOJI[row.kind],
    });
  }
}

/**
 * Insert one row per recipient + deliver on the enabled channels.
 *
 * Note the asymmetry: the in-app row and the push go to EACH recipient,
 * but Telegram fires exactly once regardless of recipient count — it's
 * one shared chat, so fanning it out would post the same order N times.
 */
export async function notifyMany(
  recipients: string[],
  template: Omit<NotificationInsert, "user_id">,
  options: NotifyOptions = {},
): Promise<void> {
  const { push = true, telegram = false } = options;

  // Telegram is independent of the recipient list — a new order still
  // belongs in the staff chat even if zero admins are set up in-app.
  if (telegram) {
    await sendTelegram({
      title: template.title,
      body: template.body,
      href: template.href,
      buttonText: KIND_BUTTON[template.kind],
      emoji: KIND_EMOJI[template.kind],
    });
  }

  if (recipients.length === 0) return;

  try {
    const admin = createAdminClient();
    const rows = recipients.map((user_id) => ({ user_id, ...template }));
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const { error } = await admin
        .from("notifications")
        .insert(rows.slice(i, i + INSERT_CHUNK));
      if (error) console.error("notifyMany failed:", error.message);
    }
  } catch (e) {
    console.error("notifyMany threw:", e);
  }

  if (push) {
    await sendPushToUsers(recipients, {
      title: template.title,
      body: template.body,
      href: template.href,
      tag: template.kind,
    });
  }
}

/**
 * Every active user id with `role`, past PostgREST's 1,000-row page (a
 * single query silently stopped there — the 1,001st buyer never heard of
 * a discount).
 */
async function listActiveIds(role: "admin" | "buyer"): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const rows = await fetchAll<{ id: string }>(() =>
      admin
        .from("profiles")
        .select("id")
        .eq("role", role)
        .eq("active", true)
        .order("id"),
    );
    return rows.map((r) => r.id);
  } catch (e) {
    console.error(`listActiveIds(${role}) failed:`, e instanceof Error ? e.message : e);
    return [];
  }
}

/** Helper: every active admin user id. Used to fan out new-order notifications. */
export function listAdminIds(): Promise<string[]> {
  return listActiveIds("admin");
}

/** Helper: every active buyer user id. Used for discount broadcasts. */
export function listBuyerIds(): Promise<string[]> {
  return listActiveIds("buyer");
}
