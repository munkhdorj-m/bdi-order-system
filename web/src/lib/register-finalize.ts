import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared, idempotent finalizer for phone registration.
 *
 * Turns a verified verify.mn session + the registration draft into a real
 * Supabase auth user + pending profile. Called from TWO places so the
 * account lands no matter what the client does:
 *
 *   1. The poll route (server-side) the instant verify.mn reports
 *      VERIFIED — survives the user closing the tab.
 *   2. completeVerification (client-triggered server action) — the
 *      redirect path that lands the user back on /login.
 *
 * Both pass the same draft (from the httpOnly cookie, which is sent with
 * the same-origin poll fetch too). Idempotent: if a profile already
 * exists for the phone it returns "exists" instead of creating a dupe, so
 * whichever caller wins, the other is a harmless no-op.
 *
 * Returns a result; never redirects (callers own navigation).
 */

export type RegisterDraft = {
  sessionId: string;
  /** E.164 with leading "+" (verify.mn format). */
  phone: string;
  fullName: string;
  password: string;
};

/**
 * Name of the httpOnly cookie carrying the in-flight registration draft.
 * Single-sourced here so the register action AND the poll route read the
 * same cookie. (Can't live in the "use server" actions file — those may
 * only export async functions.)
 */
export const PENDING_COOKIE = "bdi-verify-mn-pending";

/** Parse + validate the pending-draft cookie value. */
export function parsePendingDraft(raw: string | undefined): RegisterDraft | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as RegisterDraft;
    if (
      typeof p?.sessionId === "string" &&
      typeof p?.phone === "string" &&
      typeof p?.password === "string"
    ) {
      return { ...p, fullName: typeof p.fullName === "string" ? p.fullName : "" };
    }
    return null;
  } catch {
    return null;
  }
}

export type FinalizeResult =
  | { status: "created"; userId: string }
  | { status: "exists"; active: boolean }
  | { status: "not_verified" }
  | { status: "error"; message: string };

/** Supabase stores phones without "+"; verify.mn gives us E.164. Match both. */
function phoneVariants(phone: string): string[] {
  const withPlus = phone.startsWith("+") ? phone : `+${phone}`;
  const noPlus = phone.startsWith("+") ? phone.slice(1) : phone;
  return [withPlus, noPlus];
}

export async function finalizeRegistration(
  draft: RegisterDraft,
): Promise<FinalizeResult> {
  const admin = createAdminClient();

  // The session must be verified before we mint an account.
  const { data: row, error: rowErr } = await admin
    .from("verify_mn_sessions")
    .select("verified")
    .eq("session_id", draft.sessionId)
    .maybeSingle();
  if (rowErr) return { status: "error", message: rowErr.message };
  if (!row) return { status: "error", message: "session not found" };
  if (!row.verified) return { status: "not_verified" };

  // Already registered? (Either caller may have finalized first.)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, active")
    .in("phone", phoneVariants(draft.phone))
    .maybeSingle();
  if (existingProfile?.id) {
    return { status: "exists", active: !!existingProfile.active };
  }

  // Create the auth user — or recover an orphaned one (auth row exists
  // but profile was never written, e.g. a prior half-finished attempt).
  let userId: string | null = null;
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      phone: draft.phone,
      password: draft.password,
      phone_confirm: true,
      user_metadata: draft.fullName ? { full_name: draft.fullName } : undefined,
    });

  if (createErr) {
    if (/already (registered|exists)/i.test(createErr.message)) {
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const variants = new Set(phoneVariants(draft.phone));
      userId =
        list?.users.find((u) => u.phone && variants.has(u.phone))?.id ?? null;
      if (!userId) {
        return {
          status: "error",
          message: "auth user exists but could not be located",
        };
      }
    } else {
      return { status: "error", message: createErr.message };
    }
  } else {
    userId = created?.user?.id ?? null;
  }
  if (!userId) return { status: "error", message: "no user id after create" };

  // Belt-and-suspenders confirm — some auth versions ignore phone_confirm
  // on create, leaving phone_confirmed_at null (which blocks sign-in).
  await admin.auth.admin.updateUserById(userId, { phone_confirm: true });

  // Pending profile (active=false → admin approves). Stored without "+".
  const phoneStored = draft.phone.startsWith("+")
    ? draft.phone.slice(1)
    : draft.phone;
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      phone: phoneStored,
      full_name: draft.fullName || null,
      role: "buyer",
      active: false,
    },
    { onConflict: "id" },
  );
  if (profileErr) return { status: "error", message: profileErr.message };

  return { status: "created", userId };
}
