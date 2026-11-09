"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByPhone } from "@/lib/supabase/auth-users";
import { adminGuardError, getSession, mapAuthError } from "@/lib/auth";
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
  // Admin-only — without this guard a signed-in rep or buyer could POST
  // directly to this action and escalate their own role to admin, or
  // demote/suspend another account.
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("role, supermarket_id, active")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { error: "Хэрэглэгч олдсонгүй." };

  // A new sign-up waits as a store user without a store. Giving them a
  // store IS the approval: switch them on and tell them, in one save.
  const approving =
    before.role === "buyer" && !before.supermarket_id && role === "buyer" && !!supermarket_id;
  const isSelf = session.userId === id;

  const payload = {
    role,
    full_name: parseString(formData.get("full_name")),
    supermarket_id,
    // You can't switch yourself off (the switch is locked for you anyway).
    active: isSelf || approving || formData.get("active") === "on",
  };

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id);
  if (error) return { error: error.message };

  if (approving) {
    // Tell them after the response — a slow push service mustn't hold up the save.
    after(() =>
      notify({
        user_id: id,
        kind: "user_approved",
        title: "Таны бүртгэл баталгаажлаа",
        body: "Та одоо каталог үзэж, захиалга өгөх боломжтой боллоо.",
        href: "/catalog",
      }),
    );
    revalidatePath("/admin");
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  redirect("/admin/users");
}

type Result = { ok?: boolean; error?: string };

/**
 * Hard-delete a user account. Removes from auth.users, which cascades
 * to profiles via the FK ON DELETE CASCADE.
 *
 * Refuses to delete when:
 *   - userId is falsy
 *   - caller isn't admin
 *   - target IS the caller (would lock you out)
 *   - target is the last admin in the system (would brick admin access)
 *   - target has placed orders (orders.placed_by FK has no ON DELETE,
 *     so the DB would reject the delete with a foreign-key violation —
 *     we catch it up-front with a friendly Mongolian message and steer
 *     the admin toward switching the account off instead).
 *
 * supermarkets.assigned_rep_id is `ON DELETE SET NULL` so deleting a
 * rep just unassigns them from their stores — no extra cleanup needed.
 */
export async function deleteUser(userId: string): Promise<Result> {
  if (!userId) return { error: "Хэрэглэгчийн ID байхгүй." };

  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const session = await getSession();
  if (session?.userId === userId) {
    return { error: "Өөрийнхөө бүртгэлийг устгаж болохгүй." };
  }

  const admin = createAdminClient();

  // Guard: if this user is currently the only active admin, refuse —
  // deleting them would leave the system with no one who can manage it.
  // (An inactive admin doesn't count: removing one never lowers the
  // number of active admins.)
  const { data: target } = await admin
    .from("profiles")
    .select("role, full_name, phone, active")
    .eq("id", userId)
    .single();
  if (!target) return { error: "Хэрэглэгч олдсонгүй." };
  if (target.role === "admin" && target.active) {
    const { count: adminCount } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true);
    if ((adminCount ?? 0) <= 1) {
      return {
        error:
          "Сүүлчийн идэвхтэй админыг устгах боломжгүй. Эхлээд өөр админ томилно уу.",
      };
    }
  }

  // Guard: orders.placed_by has no ON DELETE clause, so a delete will
  // fail at the DB level if this user has any orders. Surface a
  // friendly message and recommend suspending the account instead.
  const { count: orderCount } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("placed_by", userId);
  if ((orderCount ?? 0) > 0) {
    return {
      error: `Энэ хэрэглэгч ${orderCount} захиалга үүсгэсэн тул устгах боломжгүй. Бүртгэлийг устгахын оронд идэвхгүй болгож (цуцалж) ашиглаарай.`,
    };
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    console.error("[admin/users/delete] auth.admin.deleteUser failed:", deleteErr);
    return { error: deleteErr.message };
  }

  console.info(
    "[admin/users/delete] removed user",
    userId,
    "name:",
    target.full_name,
    "by admin:",
    session?.userId,
  );

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Set a new password for a user who forgot theirs. Accounts are phone-only
 * (no email), so there's no recovery link to send: the admin sets a
 * password here and tells the user. Users can also do it themselves with
 * an SMS check at /forgot-password. The password is never logged.
 */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<Result> {
  if (!userId) return { error: "Хэрэглэгчийн ID байхгүй." };

  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return {
      error: `Нууц үг хамгийн багадаа ${MIN_PASSWORD} тэмдэгт байх ёстой.`,
    };
  }
  // Supabase (bcrypt) stops at 72 bytes; Cyrillic letters are 2 bytes each.
  if (new TextEncoder().encode(password).length > 72) {
    return { error: "Нууц үг хэт урт байна." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("[admin/users/password] updateUserById failed:", error.message);
    return { error: mapAuthError(error) };
  }

  const session = await getSession();
  console.info(
    "[admin/users/password] new password set for",
    userId,
    "by admin:",
    session?.userId,
  );
  return { ok: true };
}

/**
 * Admin creates a new user account on someone's behalf. Bypasses the
 * normal verify.mn signup flow — the admin vouches for the credentials
 * and the resulting profile lands active=true so the user can log in
 * immediately.
 *
 * Phone-only: the app dropped email login entirely. Supabase auth.users
 * stores phones without the leading "+"; we normalize and strip before
 * persisting.
 */
export async function createUserAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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

  const rawPhone = parseString(formData.get("phone"));
  if (!rawPhone) return { error: "Утасны дугаар оруулна уу." };
  const e164 = normalizeMnPhone(rawPhone);
  if (!e164) {
    return {
      error: "Утасны дугаар буруу байна (жишээ нь: 99112233).",
    };
  }
  // Supabase stores phones as digits-only (no leading "+").
  const normalizedPhone = e164.startsWith("+") ? e164.slice(1) : e164;

  const admin = createAdminClient();

  // Pre-check: refuse to create an account if the phone is already in
  // use. Supabase's admin.createUser doesn't reliably reject duplicate
  // phones across versions, so we enforce uniqueness in app code first.
  // We check BOTH profiles (canonical record) and auth.users (catches
  // orphaned auth rows from past failed flows).
  // Match either phone format (with/without leading "+") to catch
  // legacy rows in either shape.
  const phoneCandidates = [normalizedPhone, `+${normalizedPhone}`];
  const { data: dupProfile } = await admin
    .from("profiles")
    .select("id")
    .in("phone", phoneCandidates)
    .maybeSingle();
  if (dupProfile) {
    return {
      error:
        "Энэ утасны дугаар аль хэдийн бүртгэлтэй байна. Өөр дугаар сонгоно уу.",
    };
  }
  // Belt-and-suspenders: look in auth.users too (every page — reading only
  // the first 1,000 missed later accounts). Catches the case where
  // auth.users has the row but no profile (orphan).
  let dupAuth: string | null;
  try {
    dupAuth = await findAuthUserIdByPhone(admin, normalizedPhone);
  } catch (e) {
    console.error("[admin/users/create] auth lookup failed:", e);
    return { error: "Алдаа гарлаа. Дахин оролдоно уу." };
  }
  if (dupAuth) {
    return {
      error:
        "Энэ утасны дугаар аль хэдийн бүртгэлтэй байна. Өөр дугаар сонгоно уу.",
    };
  }

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      phone: normalizedPhone,
      password,
      phone_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
  if (createErr) {
    console.error("[admin/users/create] createUser failed:", createErr);
    if (/already (registered|exists)/i.test(createErr.message)) {
      return {
        error:
          "Энэ утасны дугаар аль хэдийн бүртгэлтэй байна. Өөр дугаар сонгоно уу.",
      };
    }
    return { error: createErr.message };
  }

  const userId = created?.user?.id;
  if (!userId) {
    return { error: "Хэрэглэгчийн ID олдсонгүй." };
  }

  // Belt-and-suspenders confirmation (matches register/phone path —
  // some Supabase versions don't honor the phone_confirm flag on
  // create).
  await admin.auth.admin.updateUserById(userId, {
    phone_confirm: true,
  });

  // Upsert profile. active=true because admin is vouching — no
  // pending-approval gate when an admin creates the account.
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      phone: normalizedPhone,
      role,
      active: true,
      supermarket_id: role === "buyer" ? supermarketId : null,
    },
    { onConflict: "id" },
  );
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
