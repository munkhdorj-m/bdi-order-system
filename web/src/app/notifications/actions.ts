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
