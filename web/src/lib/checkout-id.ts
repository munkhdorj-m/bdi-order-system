"use client";

import { useCallback, useRef } from "react";
import { checkoutKey, type CartScope } from "@/lib/cart";

/** A random UUID (v4) — crypto.randomUUID where the phone has it. */
function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Saved = { sig: string; id: string; at?: number };

/** A saved id is only good for re-sending the same checkout the same day. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * An earlier identical order older than this is not "the same send again":
 * the cart asks before treating it as already sent (a shop's standing
 * weekly order is often identical line for line).
 */
export const RESEND_WINDOW_MS = 10 * 60 * 1000;

/**
 * One id per checkout. Sending the SAME cart again (say, after the
 * connection dropped mid-send) reuses the id, so the server returns the
 * order it already made instead of creating a second one. Any change to
 * the cart, note or payment starts a fresh id, and so does `fresh: true`
 * ("yes, this really is a new order").
 *
 * The id is kept next to the cart in localStorage — not only in memory —
 * so it survives a reload or the app being closed after "Холболт
 * тасарлаа". clearCart() forgets it once the order went through.
 */
export function useCheckoutId(
  scope?: CartScope,
): (signature: string, opts?: { fresh?: boolean }) => string {
  const key = checkoutKey(scope);
  // Only used when the phone blocks localStorage: then it lasts this visit.
  const fallback = useRef<Saved | null>(null);
  return useCallback(
    (signature: string, opts?: { fresh?: boolean }) => {
      let saved: Saved | null = null;
      let stored = true;
      try {
        const raw = localStorage.getItem(key);
        saved = raw ? (JSON.parse(raw) as Saved) : null;
      } catch {
        stored = false;
      }
      saved ??= fallback.current;
      const now = Date.now();
      const usable =
        !opts?.fresh &&
        saved &&
        saved.sig === signature &&
        typeof saved.id === "string" &&
        // Ids saved before timestamps existed count as expired.
        typeof saved.at === "number" &&
        now - saved.at < MAX_AGE_MS;
      if (usable && saved) return saved.id;
      const next: Saved = { sig: signature, id: newUuid(), at: now };
      fallback.current = next;
      if (stored) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // full: the fallback covers this visit
        }
      }
      return next.id;
    },
    [key],
  );
}
