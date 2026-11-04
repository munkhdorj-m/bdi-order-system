"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Share } from "lucide-react";
import { toast } from "sonner";
import {
  deletePushSubscription,
  savePushSubscription,
} from "@/app/notifications/actions";

/**
 * Enable/disable OS-level push notifications for the current device.
 *
 * One row per device, not per account — an admin turns this on
 * separately on their phone and their office desktop, which is exactly
 * what you want (leaving the desk shouldn't silence the phone).
 *
 * The awkward case this UI exists to explain: iOS refuses to expose
 * PushManager to a normal Safari tab. The site MUST be added to the
 * Home Screen first. Without a message saying so, iPhone admins just
 * see a button that does nothing, so we detect it and show the
 * Share → "Add to Home Screen" instruction instead.
 */

type State =
  | "loading"
  | "unsupported"
  | "ios-needs-install"
  | "denied"
  | "off"
  | "on";

/**
 * VAPID public keys travel as base64url; PushManager wants a BufferSource.
 *
 * The explicit `new ArrayBuffer(...)` is load-bearing: TS 5.7+ made
 * Uint8Array generic over its backing buffer, and the bare
 * `new Uint8Array(length)` form widens to ArrayBufferLike (which
 * includes SharedArrayBuffer) — that no longer satisfies BufferSource.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Pull the two encryption keys off a PushSubscription as base64 strings. */
function extractKeys(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch-point check disambiguates.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** True when launched from the Home Screen rather than a browser tab. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's non-standard flag — the only reliable signal on iOS.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function PushToggle({ className }: { className?: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  /**
   * Work out where this device stands, and re-save the subscription if
   * it's already active. That re-save is the whole reason this runs on
   * every mount: browsers rotate push endpoints without telling anyone,
   * and a stale row is a device that silently stopped alerting.
   */
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!publicKey) return setState("unsupported");

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // On iOS this is the "opened in a Safari tab" case, which is
        // fixable by installing — distinguish it from a truly old browser.
        return setState(
          isIos() && !isStandalone() ? "ios-needs-install" : "unsupported",
        );
      }

      if (Notification.permission === "denied") return setState("denied");

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;

        if (existing && Notification.permission === "granted") {
          // Refresh the stored row in case the endpoint rotated.
          await savePushSubscription(extractKeys(existing), navigator.userAgent);
          if (!cancelled) setState("on");
        } else {
          setState("off");
        }
      } catch (e) {
        console.error("push sync failed:", e);
        if (!cancelled) setState("off");
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        toast.error("Мэдэгдлийн зөвшөөрөл олгогдсонгүй.");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      // register() resolves before the worker is usable; ready waits.
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        // Chrome rejects anything else — payloads must be encrypted.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await savePushSubscription(
        extractKeys(sub),
        navigator.userAgent,
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }

      setState("on");
      toast.success("Мэдэгдэл идэвхжлээ.");
    } catch (e) {
      console.error("push enable failed:", e);
      toast.error("Мэдэгдэл идэвхжүүлэхэд алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Мэдэгдэл унтраалаа.");
    } catch (e) {
      console.error("push disable failed:", e);
      toast.error("Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }, []);

  const base =
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-60";

  if (state === "loading") {
    return (
      <div
        className={`${base} text-muted-foreground ${className ?? ""}`}
        aria-busy
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Шалгаж байна…
      </div>
    );
  }

  if (state === "ios-needs-install") {
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-[12px] text-muted-foreground ${className ?? ""}`}
      >
        <Share className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          iPhone дээр мэдэгдэл авахын тулд эхлээд{" "}
          <b className="text-foreground">Хуваалцах → Нүүр дэлгэцэд нэмэх</b>{" "}
          сонголтоор апп-ыг суулгана уу.
        </span>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div
        className={`${base} text-muted-foreground ${className ?? ""}`}
        title="Энэ хөтөч push мэдэгдэл дэмжихгүй байна."
      >
        <BellOff className="h-4 w-4" />
        Мэдэгдэл дэмжихгүй
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-[12px] text-muted-foreground ${className ?? ""}`}
      >
        <BellOff className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Мэдэгдэл хаагдсан байна. Хөтөчийн хаягийн мөрөнд байрлах түгжээ дүрс
          дээр дарж{" "}
          <b className="text-foreground">Мэдэгдэл (Notifications)</b> тохиргоог
          зөвшөөрнө үү.
        </span>
      </div>
    );
  }

  const on = state === "on";
  return (
    <button
      type="button"
      onClick={on ? disable : enable}
      disabled={busy}
      className={`${base} border ${
        on
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
          : "hover:bg-muted"
      } ${className ?? ""}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : on ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {on ? "Мэдэгдэл асаалттай" : "Мэдэгдэл асаах"}
    </button>
  );
}
