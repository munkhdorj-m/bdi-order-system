"use client";

import { useCallback, useRef } from "react";
import { checkoutKey, type CartScope } from "@/lib/cart";

/** A random UUID (v4) — crypto.randomUUID where the phone has it. */
export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Saved = { sig: string; id: string };

/**
 * One id per checkout. Sending the SAME cart again (say, after the
 * connection dropped mid-send) reuses the id, so the server returns the
 * order it already made instead of creating a second one. Any change to
 * the cart, note or payment starts a fresh id.
 *
 * The id is kept next to the cart in localStorage — not only in memory —
 * so it survives a reload or the app being closed after "Холболт
 * тасарлаа". clearCart() forgets it once the order went through.
 */
export function useCheckoutId(scope?: CartScope): (signature: string) => string {
  const key = checkoutKey(scope);
  // Only used when the phone blocks localStorage: then it lasts this visit.
  const fallback = useRef<Saved | null>(null);
  return useCallback(
    (signature: string) => {
      let saved: Saved | null = null;
      let stored = true;
      try {
        const raw = localStorage.getItem(key);
        saved = raw ? (JSON.parse(raw) as Saved) : null;
      } catch {
        stored = false;
      }
      saved ??= fallback.current;
      if (saved && saved.sig === signature && typeof saved.id === "string") return saved.id;
      const next: Saved = { sig: signature, id: newUuid() };
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
