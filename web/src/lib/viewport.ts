"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * True while the media query matches. `false` on the server and during
 * hydration, then the real value — so markup never mismatches.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phone-sized screen: pickers open full-screen instead of as a dropdown. */
export const PHONE_QUERY = "(max-width: 767px)";

/**
 * Callback ref that keeps two CSS variables on the element in step with
 * the *visual* viewport — the part of the screen the phone's keyboard
 * doesn't cover:
 *
 *   --vv-h    its height (shrinks when the keyboard opens)
 *   --vv-top  how far it's scrolled within the page (iOS moves it)
 *
 * An overlay sized with them stays fully visible above the keyboard, so
 * search results never hide behind it. Listeners only live while the
 * element is mounted.
 */
export function useVisualViewportVars<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!el || !vv) return;

    // The browser already fires these at most once a frame.
    const write = () => {
      el.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
      el.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
    };
    write();
    vv.addEventListener("resize", write);
    vv.addEventListener("scroll", write);
    cleanup.current = () => {
      vv.removeEventListener("resize", write);
      vv.removeEventListener("scroll", write);
    };
  }, []);
}
