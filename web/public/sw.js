/**
 * BDI service worker — push receiver only.
 *
 * Deliberately NOT a caching/offline worker. Adding a fetch handler here
 * would put a cache in front of every Next.js RSC payload and server
 * action, which is a fast way to serve stale prices. If offline support
 * is wanted later it belongs in a proper Workbox setup, not bolted on
 * here.
 *
 * Registered by push-toggle.tsx once an admin turns notifications on.
 */

/* Take over immediately on install instead of waiting for every old tab
   to close — otherwise an updated worker sits idle for days. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
    /* Tray icon + the small badge Android shows in the status bar.
       Both are served by Next's icon.tsx / apple-icon.tsx routes. */
    icon: "/icon",
    badge: "/icon",
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
