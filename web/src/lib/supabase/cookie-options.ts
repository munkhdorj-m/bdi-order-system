import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Supabase session cookies are written by the server only (proxy, server
 * actions, route handlers) — nothing in the browser reads them, there is
 * no browser Supabase client. So they are httpOnly: injected script can't
 * lift the session tokens. Everything else keeps @supabase/ssr's defaults
 * (path "/", SameSite=Lax, 400-day max age).
 */
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
