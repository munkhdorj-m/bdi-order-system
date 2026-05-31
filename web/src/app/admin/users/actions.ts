"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { normalizeMnPhone } from "@/lib/sms/verify-mn";

type ActionState = { error?: string };

const VALID_ROLES = ["admin", "rep", "buyer"] as const;
const MIN_PASSWORD = 8;

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

/**
 * Admin creates a new user account on someone's behalf. Bypasses the
 * normal email-confirmation / verify.mn signup dance — the admin
 * vouches for the credentials and the resulting profile lands
 * active=true so the user can log in immediately.
 *
 * Either email or phone is required (not both). Supabase auth.users
 * stores phones without the leading "+"; we normalize and strip
 * before persisting.
 */
export async function createUserAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const method = parseString(formData.get("method")) ?? "phone";
  const fullName = parseString(formData.get("full_name"));
  const password = String(formData.get("password") ?? "");
  const roleRaw = parseString(formData.get("role")) ?? "buyer";
  const supermarketId = parseString(formData.get("supermarket_id"));

  if (!(VALID_ROLES as readonly string[]).includes(roleRaw)) {
    return { error: "Эрх буруу." };
  }
  const role = roleRaw as (typeof VALID_ROLES)[number];

  if (!password || password.length < MIN_PASSWORD) {
    return {
      error: `Нууц үг хамгийн багадаа ${MIN_PASSWORD} тэмдэгт байх ёстой.`,
    };
  }

  // Build the auth.users payload. Either phone OR email must be set —
  // both is allowed but rare.
  type AuthPayload = {
    email?: string;
    phone?: string;
    password: string;
    email_confirm?: boolean;
    phone_confirm?: boolean;
    user_metadata?: Record<string, string>;
  };
  const authPayload: AuthPayload = { password };

  let normalizedPhone: string | null = null;
  if (method === "phone") {
    const rawPhone = parseString(formData.get("phone"));
    if (!rawPhone) return { error: "Утасны дугаар оруулна уу." };
    const e164 = normalizeMnPhone(rawPhone);
    if (!e164) {
      return {
        error: "Утасны дугаар буруу байна (жишээ нь: 99112233).",
      };
    }
    // Supabase stores phones as digits-only (no leading "+").
    normalizedPhone = e164.startsWith("+") ? e164.slice(1) : e164;
    authPayload.phone = normalizedPhone;
    authPayload.phone_confirm = true;
  } else {
    const email = parseString(formData.get("email"));
    if (!email) return { error: "Имэйл оруулна уу." };
    authPayload.email = email;
    authPayload.email_confirm = true;
  }

  if (fullName) authPayload.user_metadata = { full_name: fullName };

  const admin = createAdminClient();
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser(authPayload);
  if (createErr) {
    console.error("[admin/users/create] createUser failed:", createErr);
    return { error: createErr.message };
  }

  const userId = created?.user?.id;
  if (!userId) {
    return { error: "Хэрэглэгчийн ID олдсонгүй." };
  }

  // Belt-and-suspenders confirmation (matches register/phone path —
  // some Supabase versions don't honor the *_confirm flag on create).
  await admin.auth.admin.updateUserById(userId, {
    email_confirm: method === "email",
    phone_confirm: method === "phone",
  });

  // Upsert profile. active=true because admin is vouching — no
  // pending-approval gate when an admin creates the account.
  const profilePayload: Record<string, unknown> = {
    id: userId,
    full_name: fullName,
    role,
    active: true,
    supermarket_id: role === "buyer" ? supermarketId : null,
  };
  if (method === "phone") profilePayload.phone = normalizedPhone;
  if (method === "email") {
    profilePayload.email = parseString(formData.get("email"));
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });
  if (profileErr) {
    console.error(
      "[admin/users/create] profile upsert failed:",
      profileErr.message,
    );
    return { error: profileErr.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect(`/admin/users/${userId}`);
}
