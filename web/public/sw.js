/**
 * BDI service worker — push receiver + a cache for the app's own code.
 *
 * Caching is deliberately narrow: only /_next/static/* (JS, CSS, fonts).
 * Those files are content-hashed — every deploy ships new names — so a
 * cached copy can never be stale, and phones (which evict their HTTP cache
 * aggressively) open the app without re-downloading it from Hong Kong.
 * Pages, RSC payloads, server actions, images and API calls are NOT
 * touched: caching those is how you serve stale prices.
 *
 * Registered for every visitor in production (sw-register.tsx) and by
 * push-toggle.tsx when an admin turns notifications on.
 */

const STATIC_CACHE = "bdi-static-v1";
const MAX_STATIC_ENTRIES = 400;
// Dev servers rebuild chunks in place; never cache there.
const DEV_HOST = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

/* Take over immediately on install instead of waiting for every old tab
   to close — otherwise an updated worker sits idle for days. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions of this worker.
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("bdi-") && n !== STATIC_CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Oldest entries out once the cache passes the cap (old deploys' chunks). */
async function trimStatic(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (DEV_HOST || req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          event.waitUntil(cache.put(req, res.clone()).then(() => trimStatic(cache)));
        }
        return res;
      } catch {
        // Cache API trouble must never break the page — go straight to the network.
        return fetch(req);
      }
    })(),
  );
});

/**
 * A push arrived. The payload is the JSON that lib/push.ts encrypted;
 * we defensively fall back to a generic message if it's missing or
 * unparseable (some browsers fire a tickle with no data at all).
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "BDI Захиалга";
  const options = {
    body: data.body || "",
    /* Tray icon (app/icon.tsx) + the small status-bar badge, which
       Android draws from the alpha channel only — so it's a white "BDI"
       on transparent (public/badge.png), not the square app icon. */
    icon: "/icon",
    badge: "/badge.png",
    /* Same tag replaces rather than stacks — keeps a burst of orders
       from filling the whole notification shade. */
    tag: data.tag || "bdi",
    renotify: true,
    /* Buzz the phone. Ignored on desktop. */
    vibrate: [100, 50, 100],
    /* Passed through to the click handler below. */
    data: { href: data.href || "/" },
    /* Stay in the tray until acknowledged — an order shouldn't quietly
       auto-dismiss while the admin is away from the desk. */
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Tapped. Focus an already-open BDI tab and route it to the target
 * instead of piling up new windows; only open a fresh one if nothing
 * is running.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  const target = new URL(href, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.focus().then((c) => {
              if (c && "navigate" in c) return c.navigate(target);
              return c;
            });
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
