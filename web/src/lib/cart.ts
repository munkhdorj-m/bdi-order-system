"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type CartItem = {
  product_id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  /** Catalog list price BEFORE any discount. The cart engine in
   *  lib/discount.ts re-applies active rules so the buyer can see the
   *  per-product and cash discounts itemized. */
  unit_price: number;
  /** Optional — used by the discount engine to match per-category rules. */
  category_id?: string | null;
  /** Category picture key (lib/category-visual.tsx), shown when there's no photo. */
  category_icon?: string | null;
  qty: number;
};

// Optional scope so reps can keep a separate cart per store.
// Buyer flow passes no scope → uses the default key.
export type CartScope = { storeId?: string };

const BASE_KEY = "bdi-cart-v1";
const EVENT_NAME = "bdi-cart-change";

function keyFor(scope?: CartScope): string {
  return scope?.storeId ? `${BASE_KEY}:store:${scope.storeId}` : BASE_KEY;
}

function safeRead(scope?: CartScope): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyFor(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: CartItem[], scope?: CartScope) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(scope), JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { key: keyFor(scope) } }),
  );
}

export function getCart(scope?: CartScope): CartItem[] {
  return safeRead(scope);
}

export function addToCart(
  item: Omit<CartItem, "qty">,
  qty: number = 1,
  scope?: CartScope,
): CartItem[] {
  if (qty <= 0) return getCart(scope);
  const items = getCart(scope);
  const existing = items.find((i) => i.product_id === item.product_id);
  if (existing) {
    existing.qty += qty;
    existing.unit_price = item.unit_price;
    existing.name = item.name || existing.name;
    // Callers that don't know these (e.g. reorder) mustn't wipe them.
    existing.brand = item.brand ?? existing.brand ?? null;
    existing.image_url = item.image_url ?? existing.image_url ?? null;
    existing.category_id = item.category_id ?? existing.category_id ?? null;
    existing.category_icon = item.category_icon ?? existing.category_icon ?? null;
  } else {
    items.push({ ...item, qty });
  }
  safeWrite(items, scope);
  return items;
}

export function updateQty(
  productId: string,
  qty: number,
  scope?: CartScope,
): CartItem[] {
  const next = qty <= 0
    ? getCart(scope).filter((i) => i.product_id !== productId)
    : getCart(scope).map((i) =>
        i.product_id === productId ? { ...i, qty: Math.floor(qty) } : i,
      );
  safeWrite(next, scope);
  return next;
}

export function removeFromCart(
  productId: string,
  scope?: CartScope,
): CartItem[] {
  const next = getCart(scope).filter((i) => i.product_id !== productId);
  safeWrite(next, scope);
  return next;
}

export function clearCart(scope?: CartScope): void {
  safeWrite([], scope);
}

/**
 * Bring a saved cart in line with today's prices (product_id → price for
 * this store): re-price lines whose price changed and drop products no
 * longer sold. A cart can sit on a phone for days; without this its total
 * would differ from the order the server actually prices.
 */
export function syncCartPrices(
  prices: Record<string, number>,
  scope?: CartScope,
): { repriced: number; removed: string[] } {
  const items = getCart(scope);
  let repriced = 0;
  const removed: string[] = [];
  const next: CartItem[] = [];
  for (const it of items) {
    const price = prices[it.product_id];
    if (price === undefined) {
      removed.push(it.name);
    } else if (Number(price) !== Number(it.unit_price)) {
      repriced++;
      next.push({ ...it, unit_price: Number(price) });
    } else {
      next.push(it);
    }
  }
  if (repriced > 0 || removed.length > 0) safeWrite(next, scope);
  return { repriced, removed };
}

export function totalQty(items?: CartItem[]): number {
  return (items ?? getCart()).reduce((sum, i) => sum + i.qty, 0);
}

export function totalAmount(items?: CartItem[]): number {
  return (items ?? getCart()).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
}

export { formatMnt } from "./format";

// ---- useCart: useSyncExternalStore plumbing -------------------------
//
// The cart lives in localStorage and broadcasts changes via a custom
// event — a textbook external store, so useSyncExternalStore is the
// right hook (the previous useState+useEffect version triggered the
// react-hooks/set-state-in-effect lint error and an extra render).
//
// getSnapshot must return a referentially-stable value when nothing
// changed, or React loops forever re-rendering. localStorage hands us a
// fresh string each read, so we cache the parsed array per storage key
// and only re-parse when the raw JSON actually differs.

const EMPTY_CART: CartItem[] = [];
const snapshotCache = new Map<string, { raw: string; items: CartItem[] }>();

function getCartSnapshot(key: string): CartItem[] {
  const raw = localStorage.getItem(key);
  if (raw === null) return EMPTY_CART;
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.items;
  let items: CartItem[];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    items = Array.isArray(parsed) ? parsed : EMPTY_CART;
  } catch {
    items = EMPTY_CART;
  }
  snapshotCache.set(key, { raw, items });
  return items;
}

function subscribeToCart(key: string, onChange: () => void): () => void {
  const refresh = (e?: Event) => {
    // Same-window writes tag the event with the storage key they
    // touched — skip changes for other scopes. Cross-tab "storage"
    // events have no detail; let those through unconditionally.
    const detail = (e as CustomEvent | undefined)?.detail as
      | { key?: string }
      | undefined;
    if (detail?.key && detail.key !== key) return;
    onChange();
  };
  window.addEventListener(EVENT_NAME, refresh);
  window.addEventListener("storage", refresh);
  return () => {
    window.removeEventListener(EVENT_NAME, refresh);
    window.removeEventListener("storage", refresh);
  };
}

export function useCart(scope?: CartScope): CartItem[] {
  const key = keyFor(scope);
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToCart(key, onChange),
    [key],
  );
  const getSnapshot = useCallback(() => getCartSnapshot(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CART);
}

// ---- Every store's cart at once (rep home) ---------------------------

const STORE_PREFIX = `${BASE_KEY}:store:`;

// "id:lines|id:lines" — a string, so the snapshot compares by value.
function storeCartSizesSnapshot(): string {
  const parts: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORE_PREFIX)) continue;
    const lines = getCartSnapshot(key).length;
    if (lines > 0) parts.push(`${key.slice(STORE_PREFIX.length)}:${lines}`);
  }
  return parts.sort().join("|");
}

function subscribeAllCarts(onChange: () => void): () => void {
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** How many products sit in each store's cart on this phone (rep flow). */
export function useStoreCartSizes(): Record<string, number> {
  const snap = useSyncExternalStore(subscribeAllCarts, storeCartSizesSnapshot, () => "");
  return useMemo(
    () =>
      Object.fromEntries(
        snap
          ? snap.split("|").map((part) => {
              const [id, n] = part.split(":");
              return [id, Number(n)] as const;
            })
          : [],
      ),
    [snap],
  );
}
