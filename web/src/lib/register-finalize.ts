import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByPhone } from "@/lib/supabase/auth-users";
import { listAdminIds, notifyMany } from "@/lib/notify";
import type { RegisterDraft } from "@/lib/sms/draft-cookie";
import {
  claimVerifiedSession,
  isPurpose,
  loadSmsSession,
  releaseSession,
} from "@/lib/sms/sessions";
import { phoneVariants } from "@/lib/sms/verify-mn";

/**
 * Turns a verified verify.mn check + the sealed registration draft into a
 * Supabase auth user + a pending profile. Called from TWO places so the
 * account lands whatever the client does:
 *
 *   1. the poll route, the moment verify.mn reports VERIFIED (survives the
 *      user closing the tab);
 *   2. completeVerification, the redirect path back to /login.
 *
 * Rules (each one closes a way to mint accounts for phones nobody verified):
 *   - the session must be THIS phone's registration check — never another
 *     number's, never a password-reset check;
 *   - one verified SMS makes at most one account: the session is used with
 *     a single UPDATE … WHERE purpose = 'register' RETURNING, so of two
 *     racing callers only one goes on; the other finds the result.
 *
 * Returns a result; never redirects (callers own navigation).
 */

export type FinalizeResult =
  | { status: "created"; userId: string }
  | { status: "exists"; active: boolean }
  | { status: "not_verified" }
  | { status: "error"; message: string };

async function profileByPhone(
  admin: SupabaseClient,
  phone: string,
): Promise<{ id: string; active: boolean } | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, active")
    .in("phone", phoneVariants(phone))
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id as string, active: !!data.active } : null;
}

export async function finalizeRegistration(
  draft: RegisterDraft,
): Promise<FinalizeResult> {
  const row = await loadSmsSession(draft.sessionId);
  if (!row) return { status: "error", message: "session not found" };
  if (row.phone !== draft.phone || !isPurpose(row.purpose, "register")) {
    return { status: "error", message: "session does not match the draft" };
  }
  if (!row.verified) return { status: "not_verified" };

  const admin = createAdminClient();

  if (!(await claimVerifiedSession(draft.sessionId, draft.phone, "register"))) {
    // Already used — normally by the other caller, a moment ago.
    const existing = await profileByPhone(admin, draft.phone);
    return existing
      ? { status: "exists", active: existing.active }
      : { status: "error", message: "session already used" };
  }

  // From here on the check is ours. Any failure hands it back so a retry
  // doesn't need (and pay for) a new SMS.
  const fail = async (message: string): Promise<FinalizeResult> => {
    await releaseSession(draft.sessionId, "register");
    return { status: "error", message };
  };

  const existing = await profileByPhone(admin, draft.phone);
  if (existing) return { status: "exists", active: existing.active };

  // Create the auth user — or recover an orphaned one (auth row exists but
  // the profile was never written, e.g. a half-finished earlier attempt).
  let userId: string | null = null;
  let recovered = false;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    phone: draft.phone,
    password: draft.password,
    phone_confirm: true,
    user_metadata: draft.fullName ? { full_name: draft.fullName } : undefined,
  });
  if (createErr) {
    if (!/already (registered|exists)/i.test(createErr.message)) {
      return fail(createErr.message);
    }
    try {
      userId = await findAuthUserIdByPhone(admin, draft.phone);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
    if (!userId) return fail("auth user exists but could not be located");
    recovered = true;
  } else {
    userId = created?.user?.id ?? null;
  }
  if (!userId) return fail("no user id after create");

  // Confirm the phone (some auth versions ignore phone_confirm on create,
  // which blocks sign-in). A recovered account also gets the password just
  // chosen — its owner has proven the phone, exactly as in a reset.
  const { error: confirmErr } = await admin.auth.admin.updateUserById(userId, {
    phone_confirm: true,
    ...(recovered ? { password: draft.password } : {}),
  });
  if (confirmErr) console.error("[register] phone confirm failed:", confirmErr.message);

  // Pending profile: a store user without a store, switched off until an
  // admin assigns the store. Stored without "+".
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      phone: draft.phone.replace(/^\+/, ""),
      full_name: draft.fullName || null,
      role: "buyer",
      active: false,
    },
    { onConflict: "id" },
  );
  if (profileErr) return fail(profileErr.message);

  // Tell the admins someone is waiting — after the response, so the
  // verify page isn't held up by push + Telegram. notifyMany swallows its
  // own errors; a failed alert never fails the sign-up.
  const body = `${draft.fullName || "Нэргүй"} · ${draft.phone} — зөвшөөрөл хүлээж байна.`;
  const href = `/admin/users/${userId}`;
  after(async () => {
    const adminIds = await listAdminIds();
    await notifyMany(
      adminIds,
      { kind: "user_pending", title: "Шинэ хэрэглэгч бүртгүүллээ", body, href },
      { telegram: true },
    );
  });

  return { status: "created", userId };
}
