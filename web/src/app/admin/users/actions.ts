"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { notify } from "@/lib/notify";

type ActionState = { error?: string };

const VALID_ROLES = ["admin", "rep", "buyer"] as const;

function parseString(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function updateUser(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const role = parseString(formData.get("role"));
  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    return { error: "Эрх буруу." };
  }

  // Guard: can't demote yourself out of admin (avoids lockout)
  const session = await getSession();
  if (!session) return { error: "Хандах эрхгүй." };
  if (session.userId === id && role !== "admin") {
    return { error: "Өөрийнхөө админ эрхийг хасч болохгүй." };
  }

  const supermarketRaw = parseString(formData.get("supermarket_id"));
  const supermarket_id = role === "buyer" ? supermarketRaw : null;

  const payload = {
    role,
    full_name: parseString(formData.get("full_name")),
    supermarket_id,
    active: formData.get("active") === "on",
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  redirect("/admin/users");
}

type Result = { ok?: boolean; error?: string };

async function requireAdmin(): Promise<Result | { admin: true }> {
  const session = await getSession();
  if (!session) return { error: "Нэвтэрнэ үү." };
  if (session.profile.role !== "admin") {
    return { error: "Зөвхөн админ хийх боломжтой." };
  }
  return { admin: true };
}

/**
 * Approve a pending user — flip their profiles.active to true so they can
 * sign in. New sign-ups land with active=false thanks to fix 17 so admins
 * gate every account before it gains catalog access.
 */
export async function approveUser(userId: string): Promise<Result> {
  if (!userId) return { error: "Хэрэглэгчийн ID байхгүй." };

  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ active: true })
    .eq("id", userId)
    .select("id, active");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Хэрэглэгч олдсонгүй." };
  }

  // Notify the user that they're now active. Fire-and-forget.
  await notify({
    user_id: userId,
    kind: "user_approved",
    title: "Таны бүртгэл баталгаажлаа",
    body: "Та одоо нэвтрэн каталог үзэх боломжтой боллоо.",
    href: "/catalog",
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Revoke a user — sets active=false. Useful when admins need to suspend
 * an account without deleting it. Counterpart to approveUser.
 */
export async function revokeUser(userId: string): Promise<Result> {
  if (!userId) return { error: "Хэрэглэгчийн ID байхгүй." };

  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const session = await getSession();
  if (session?.userId === userId) {
    return { error: "Өөрийн эрхээ цуцалж болохгүй." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ active: false })
    .eq("id", userId)
    .select("id, active");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Хэрэглэгч олдсонгүй." };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
