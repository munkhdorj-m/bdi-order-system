import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { normalizeMnPhone } from "./verify-mn";
import { passwordErrorCode } from "@/lib/auth";

/**
 * Sealed cookies for the two SMS checks (registration, password reset).
 *
 * Each draft carries a password from the form to the moment the phone is
 * verified, so the cookie is encrypted AND authenticated (AES-256-GCM):
 * the browser can neither read it nor change one field of it. The phone,
 * the verify.mn session id and the password come back exactly as the
 * server wrote them, or not at all. (Before, it was plain JSON — editing
 * the phone in it registered numbers nobody had verified.)
 *
 * The key is derived with HKDF-SHA-256 from a server-only secret:
 * DRAFT_COOKIE_SECRET when set, otherwise SUPABASE_SERVICE_ROLE_KEY.
 * Changing the secret only cancels drafts in flight (10-minute lifetime).
 * The cookie name is bound in as associated data, so a reset draft can't
 * be replayed as a registration draft or the other way round.
 */

export const REGISTER_DRAFT_COOKIE = "bdi-verify-mn-pending";
export const RESET_DRAFT_COOKIE = "bdi-password-reset";

/** verify.mn sessions last 300 s; a draft lives a little longer. */
export const DRAFT_TTL_S = 600;

export type RegisterDraft = {
  sessionId: string;
  /** E.164 with leading "+" (verify.mn format). */
  phone: string;
  fullName: string;
  password: string;
};

export type ResetDraft = {
  sessionId: string;
  phone: string;
  password: string;
};

/** Longest name we keep from the sign-up form. */
export const MAX_FULL_NAME = 100;

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let derivedKey: Buffer | null = null;

function key(): Buffer {
  if (derivedKey) return derivedKey;
  const secret =
    process.env.DRAFT_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "DRAFT_COOKIE_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set to seal draft cookies",
    );
  }
  derivedKey = Buffer.from(
    hkdfSync("sha256", secret, "bdi-draft-cookie", "aes-256-gcm/v1", 32),
  );
  return derivedKey;
}

function seal(name: string, data: Record<string, unknown>): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(name, "utf8"));
  const plain = Buffer.from(
    JSON.stringify({ ...data, exp: Date.now() + DRAFT_TTL_S * 1000 }),
    "utf8",
  );
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const packed = Buffer.concat([iv, cipher.getAuthTag(), body]);
  return `${VERSION}.${packed.toString("base64url")}`;
}

function unseal(
  name: string,
  raw: string | undefined,
): Record<string, unknown> | null {
  if (!raw || !raw.startsWith(`${VERSION}.`)) return null;
  try {
    const packed = Buffer.from(raw.slice(VERSION.length + 1), "base64url");
    if (packed.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      packed.subarray(0, IV_BYTES),
      { authTagLength: TAG_BYTES },
    );
    decipher.setAAD(Buffer.from(name, "utf8"));
    decipher.setAuthTag(packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const plain = Buffer.concat([
      decipher.update(packed.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
    const data = JSON.parse(plain) as Record<string, unknown>;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    // Tampered, truncated, sealed with another key, or an old plain-JSON
    // draft from before sealing — all mean "no draft".
    return null;
  }
}

/** Cookie attributes shared by both drafts. */
export function draftCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: DRAFT_TTL_S,
  };
}

function validSessionId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 200;
}

/** Same checks as the form, so a draft is valid even if it got in some other way. */
function validPassword(v: unknown): v is string {
  return typeof v === "string" && passwordErrorCode(v) === null;
}

export function sealRegisterDraft(draft: RegisterDraft): string {
  return seal(REGISTER_DRAFT_COOKIE, draft);
}

export function readRegisterDraft(raw: string | undefined): RegisterDraft | null {
  const d = unseal(REGISTER_DRAFT_COOKIE, raw);
  if (!d || !validSessionId(d.sessionId) || !validPassword(d.password)) return null;
  const phone = typeof d.phone === "string" ? normalizeMnPhone(d.phone) : null;
  if (!phone) return null;
  const fullName =
    typeof d.fullName === "string" ? d.fullName.trim().slice(0, MAX_FULL_NAME) : "";
  return { sessionId: d.sessionId, phone, fullName, password: d.password };
}

export function sealResetDraft(draft: ResetDraft): string {
  return seal(RESET_DRAFT_COOKIE, draft);
}

export function readResetDraft(raw: string | undefined): ResetDraft | null {
  const d = unseal(RESET_DRAFT_COOKIE, raw);
  if (!d || !validSessionId(d.sessionId) || !validPassword(d.password)) return null;
  const phone = typeof d.phone === "string" ? normalizeMnPhone(d.phone) : null;
  if (!phone) return null;
  return { sessionId: d.sessionId, phone, password: d.password };
}
