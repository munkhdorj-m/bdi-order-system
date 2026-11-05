"use client";

import { useCallback, useRef } from "react";

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

/**
 * One id per checkout. Sending the SAME cart again (say, after the
 * connection dropped mid-send) reuses the id, so the server returns the
 * order it already made instead of creating a second one. Any change to
 * the cart, note or payment starts a fresh id.
 */
export function useCheckoutId(): (signature: string) => string {
  const current = useRef<{ sig: string; id: string } | null>(null);
  return useCallback((signature: string) => {
    if (!current.current || current.current.sig !== signature) {
      current.current = { sig: signature, id: newUuid() };
    }
    return current.current.id;
  }, []);
}
