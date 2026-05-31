"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapAuthError } from "@/lib/auth";
import {
  createPhoneVerification,
  normalizeMnPhone,
} from "@/lib/sms/verify-mn";

// ---------- tunables ----------
const MIN_PASSWORD = 8;

// Cookie carrying the in-flight registration draft between the phone-entry
// step and the verify step. httpOnly so JS can't read the password.
// 10-minute TTL matches verify.mn's 300s session window plus a buffer.
const PENDING_COOKIE = "bdi-verify-mn-pending";
const PENDING_COOKIE_TTL_S = 600;

type PendingDraft = {
  sessionId: string;
  phone: string;
  fullName: string;
  password: string;
};

async function setPendingCookie(draft: PendingDraft): Promise<void> {
  const store = await cookies();
  store.set(PENDING_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_COOKIE_TTL_S,
  });
}

async function readPendingCookie(): Promise<PendingDraft | null> {
  const store = await cookies();
  const raw = store.get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingDraft;
    if (
      typeof parsed?.sessionId === "string" &&
      typeof parsed?.phone === "string" &&
      typeof parsed?.password === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function clearPendingCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
}

/**
 * Best-guess site origin from request headers, falling back to
 * NEXT_PUBLIC_SITE_URL. Used for the callback URL we hand to verify.mn —
 * which MUST be HTTPS and absolute.
 */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${proto}://${host}`;
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  throw new Error("Could not determine site origin for verify.mn callback");
}

/**
 * Phone format normalization. We pass +976XXXXXXXX (E.164) to verify.mn
 * because that's what its API expects, but Supabase Auth stores phones
 * WITHOUT the leading "+". So when comparing against auth.users or
 * profiles.phone, we need to check both forms.
 */
function phoneVariants(phone: string): string[] {
  const withPlus = phone.startsWith("+") ? phone : `+${phone}`;
  const noPlus = phone.startsWith("+") ? phone.slice(1) : phone;
  return [withPlus, noPlus];
}

// ============================================================
// startVerification — collect name + phone + password, kick off a
// verify.mn session, stash the draft in an httpOnly cookie, redirect
// to the verify page where the user is shown the smsUri / instructions.
// ============================================================
export async function startVerification(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Овог нэрээ оруулна уу.")}`,
    );
  }
  const phone = normalizeMnPhone(rawPhone);
  if (!phone) {
    redirect(
      `/register/phone?error=${encodeURIComponent(
        "Утасны дугаар буруу байна (жишээ нь: 99112233).",
      )}&name=${encodeURIComponent(fullName)}`,
    );
  }
  if (!password || password.length < MIN_PASSWORD) {
    redirect(
      `/register/phone?error=${encodeURIComponent(
        `Нууц үг хамгийн багадаа ${MIN_PASSWORD} тэмдэгт байх ёстой.`,
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }
  if (password !== confirmPassword) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Нууц үг таарахгүй байна.")}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // Build the absolute callback URL verify.mn will hit when the user's
  // SMS lands. The {sessionId} segment lets the route handler identify
  // which session to mark verified.
  const origin = await siteOrigin();

  let session;
  try {
    // We pass a placeholder URL on first try; verify.mn assigns the
    // sessionId in its response. Once we have it, the callback URL is
    // baked into our route (which the verify.mn server pings with the
    // sessionId-bearing path). To produce a URL containing the
    // sessionId BEFORE we have one, we use a verify-mn convention:
    // include `{sessionId}` literal in the URL and verify.mn will not
    // substitute. So instead we accept that the callback URL is
    // session-aware: we let our route handler look the sessionId up
    // via the path param.
    // verify.mn requires a callback URL but fires GET to that exact URL
    // with no sessionId substitution — so a per-session callback URL
    // isn't reachable from inside the createSession call (we don't have
    // the sessionId yet). Point it at a single no-op endpoint; the
    // client poller handles verification discovery via direct status
    // polls, which is the source of truth anyway.
    session = await createPhoneVerification({
      phone,
      callbackUrl: `${origin}/api/verify-mn/callback/noop`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[register/phone] createPhoneVerification failed:", msg);
    redirect(
      `/register/phone?error=${encodeURIComponent(
        mapAuthError("verify-mn-failed", "register"),
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // Now that we know the sessionId, write the actual callback URL into
  // our own DB row — verify.mn already has the URL it'll ping, but we
  // track the sessionId so callback + poll can find our row. (If we
  // ever need verify.mn to ping a session-specific URL we'd need a
  // second updateSession API call, which verify.mn doesn't expose;
  // for now the single placeholder path is fine because our callback
  // route reads sessionId from the path param.)
  //
  // Insert the DB row tracking this session. callback + poll both
  // need it to confirm verification.
  const admin = createAdminClient();
  const { error: insertErr } = await admin
    .from("verify_mn_sessions")
    .insert({
      session_id: session.sessionId,
      phone,
      purpose: "register",
      code: session.text,
      sms_uri: session.smsUri,
      display_instruction: session.displayInstruction,
      verified: false,
      expires_at: session.expiresAt,
    });
  if (insertErr) {
    console.error(
      "[register/phone] verify_mn_sessions insert failed:",
      insertErr.message,
    );
    redirect(
      `/register/phone?error=${encodeURIComponent(
        "Алдаа гарлаа. Дахин оролдоно уу.",
      )}&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`,
    );
  }

  // Stash the draft + sessionId for the verify step.
  await setPendingCookie({
    sessionId: session.sessionId,
    phone,
    fullName,
    password,
  });

  redirect(`/register/phone/verify?session=${encodeURIComponent(session.sessionId)}`);
}

// ============================================================
// completeVerification — called from the verify page once the client
// poller has confirmed the session is verified. Reads the cookie,
// double-checks the DB row, creates the auth user with phone+password,
// clears the cookie.
// ============================================================
export async function completeVerification() {
  const pending = await readPendingCookie();
  if (!pending) {
    redirect(
      `/register/phone?error=${encodeURIComponent("Бүртгэлийн мэдээлэл хугацаа дууссан. Дахин эхлүүлнэ үү.")}`,
    );
  }

  const admin = createAdminClient();
  const { data: row, error: rowErr } = await admin
    .from("verify_mn_sessions")
    .select("session_id, verified")
    .eq("session_id", pending.sessionId)
    .maybeSingle();
  if (rowErr || !row) {
    console.error("[register/phone] completeVerification: row missing");
    redirect(
      `/register/phone?error=${encodeURIComponent("Сесс олдсонгүй. Дахин эхлүүлнэ үү.")}`,
    );
  }
  if (!row.verified) {
    redirect(
      `/register/phone/verify?session=${encodeURIComponent(pending.sessionId)}&error=${encodeURIComponent("Утас баталгаажаагүй байна.")}`,
    );
  }

  // Step 1: figure out the auth user id. Either find an existing
  // profile with this phone (means a previous attempt got partway
  // through), or create a fresh auth user.
  let userId: string | null = null;

  // Check existing profile by phone first — if someone already
  // partially registered with this number, reuse their id rather
  // than create a duplicate auth user. We `.in()` both phone variants
  // (with and without "+") because we may have legacy profile rows in
  // either format.
  {
    const { data: existingProfile, error: existingErr } = await admin
      .from("profiles")
      .select("id")
      .in("phone", phoneVariants(pending.phone))
      .maybeSingle();
    if (existingErr) {
      console.error(
        "[register/phone] profile lookup by phone failed:",
        existingErr.message,
      );
    }
    if (existingProfile?.id) {
      userId = existingProfile.id;
      console.info(
        "[register/phone] reusing existing profile for phone:",
        pending.phone,
      );
    }
  }

  // No existing profile → create the auth user.
  if (!userId) {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        phone: pending.phone,
        password: pending.password,
        phone_confirm: true,
        user_metadata: pending.fullName
          ? { full_name: pending.fullName }
          : undefined,
      });

    if (createErr) {
      // "Already registered" means there's an auth.users row but no
      // matching profile (we'd have caught it above otherwise). Look
      // it up via listUsers so we can still attach a profile.
      if (/already (registered|exists)/i.test(createErr.message)) {
        console.warn(
          "[register/phone] createUser said already-exists; looking up by phone",
        );
        const { data: list, error: listErr } =
          await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listErr) {
          console.error("[register/phone] listUsers failed:", listErr);
        }
        // Supabase stores phones WITHOUT the leading "+" while we keep
        // E.164 internally. Match against both forms so the listUsers
        // result doesn't silently miss a row purely because of `+`.
        const variants = new Set(phoneVariants(pending.phone));
        userId =
          list?.users.find((u) => u.phone && variants.has(u.phone))?.id ??
          null;
        if (!userId) {
          console.error(
            "[register/phone] listUsers couldn't find the phone in either format; aborting",
            "looking for:",
            Array.from(variants).join(" or "),
          );
          redirect(
            `/register/phone/verify?session=${encodeURIComponent(pending.sessionId)}&error=${encodeURIComponent("Бүртгэл үүсгэхэд алдаа гарлаа. Админд хандана уу.")}`,
          );
        }
      } else {
        console.error("[register/phone] createUser failed:", createErr);
        redirect(
          `/register/phone/verify?session=${encodeURIComponent(pending.sessionId)}&error=${encodeURIComponent(mapAuthError(createErr, "register"))}`,
        );
      }
    } else {
      userId = created?.user?.id ?? null;
    }
  }

  if (!userId) {
    // Should be unreachable — every branch above either sets userId
    // or redirects. Belt-and-suspenders.
    console.error(
      "[register/phone] reached profile upsert with null userId",
    );
    redirect(
      `/register/phone/verify?session=${encodeURIComponent(pending.sessionId)}&error=${encodeURIComponent("Бүртгэл үүсгэхэд алдаа гарлаа. Админд хандана уу.")}`,
    );
  }

  // Belt-and-suspenders: explicitly mark phone as confirmed.
  // `phone_confirm: true` on admin.createUser is supposed to set
  // phone_confirmed_at, but in practice some supabase-auth versions
  // silently ignore the flag and leave it NULL — which then blocks
  // signInWithPassword for that user with "Invalid login credentials".
  // updateUserById here makes sure the flag lands every time.
  {
    const { error: confirmErr } = await admin.auth.admin.updateUserById(
      userId,
      { phone_confirm: true },
    );
    if (confirmErr) {
      console.warn(
        "[register/phone] phone_confirm update failed:",
        confirmErr.message,
      );
      // Not fatal — fix 28 (one-shot SQL) handles users where this
      // failed, and admin can also flip it via SQL directly.
    }
  }

  // Step 2: upsert the profile. This is REQUIRED — if it fails the
  // user won't appear in /admin/users and admin can't approve them.
  // No silent no-op like before.
  //
  // We store phones WITHOUT the leading "+" to match Supabase Auth's
  // `auth.users.phone` format. Going forward, profile lookups should
  // expect this format; the phoneVariants helper above guards against
  // legacy data in either format.
  const phoneStored = pending.phone.startsWith("+")
    ? pending.phone.slice(1)
    : pending.phone;
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        phone: phoneStored,
        full_name: pending.fullName || null,
        role: "buyer",
        active: false,
      },
      { onConflict: "id" },
    );

  if (profileErr) {
    console.error(
      "[register/phone] profile upsert failed:",
      profileErr.message,
      "userId:",
      userId,
      "phone:",
      pending.phone,
    );
    redirect(
      `/register/phone/verify?session=${encodeURIComponent(pending.sessionId)}&error=${encodeURIComponent("Бүртгэл хадгалахад алдаа гарлаа: " + profileErr.message.slice(0, 80))}`,
    );
  }

  console.info(
    "[register/phone] registration complete — userId:",
    userId,
    "phone:",
    pending.phone,
    "name:",
    pending.fullName,
  );

  await clearPendingCookie();
  redirect("/login?success=phone-verified");
}
