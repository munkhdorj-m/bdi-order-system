"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js for every visitor in production so the installed app
 * keeps its own code (see public/sw.js — only content-hashed static files
 * are cached). Push notifications still need the admin's explicit opt-in.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* unsupported / private mode — the app works without it */
    });
  }, []);
  return null;
}
