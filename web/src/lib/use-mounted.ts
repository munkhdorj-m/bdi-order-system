"use client";

import { useSyncExternalStore } from "react";

// Never fires — mount status doesn't change after hydration, so there's
// nothing to subscribe to. useSyncExternalStore still needs a subscribe
// function; this stable no-op keeps it from re-subscribing every render.
const emptySubscribe = () => () => {};

/**
 * `false` during SSR and the hydration render, `true` afterwards.
 *
 * Use this to gate browser-only reads (navigator, matchMedia,
 * next-themes' resolvedTheme) that would otherwise mismatch the server
 * HTML. Built on useSyncExternalStore instead of the
 * useState+useEffect("set mounted") pattern, which triggers a cascading
 * second render and the react-hooks/set-state-in-effect lint error.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
