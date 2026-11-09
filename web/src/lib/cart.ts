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

/**
 * Whose cart this is. A rep keeps one cart per store (`{ storeId }`); a
 * store's own app keys its cart by its supermarket
 * (`{ storeId, owner: "buyer" }`), so two shops signed in one after the
 * other on the same phone never share a cart.
 */
export type CartScope = { storeId?: string; owner?: "rep" | "buyer" };

const BASE_KEY = "bdi-cart-v1";
const EVENT_NAME = "bdi-cart-change";
const STORE_PREFIX = `${BASE_KEY}:store:`;

/** localStorage key of a cart. No scope = the old shared store cart. */
export function cartKey(scope?: CartScope): string {
  if (!scope?.storeId) return BASE_KEY;
  return scope.owner === "buyer"
    ? `${BASE_KEY}:buyer:${scope.storeId}`
    : `${STORE_PREFIX}${scope.storeId}`;
}

/** Where a cart's checkout id is kept (lib/checkout-id.ts). */
export function checkoutKey(scope?: CartScope): string {
  return `bdi-checkout-v1:${cartKey(scope)}`;
}

export type CartChangeDetail = { key: string; lines: number; prevLines: number };

// ---- Storage, mirrored in memory -------------------------------------
//
// Every card in the catalog reads the cart. Reading localStorage (and
// parsing it) for each of them on every change was the slow part, so the
// raw JSON is mirrored in memory and parsed once per change. Writes go
// through write(); other tabs' writes arrive as "storage" events.

const rawCache = new Map<string, string | null>();

function readRaw(key: string): string | null {
  if (rawCache.has(key)) return rawCache.get(key) ?? null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  rawCache.set(key, raw);
  return raw;
}

function parseItems(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** A fresh, mutable copy of a cart. */
function readItems(key: string): CartItem[] {
  return parseItems(readRaw(key));
}

type Snapshot = { raw: string | null; items: CartItem[]; qty: Map<string, number> };

const EMPTY_CART: CartItem[] = [];
const EMPTY_SNAPSHOT: Snapshot = { raw: null, items: EMPTY_CART, qty: new Map() };
const snapshots = new Map<string, Snapshot>();

/**
 * The parsed cart for a key — the SAME object until the cart changes, as
 * useSyncExternalStore requires (a fresh array each read would loop).
 */
function snapshotFor(key: string): Snapshot {
  const raw = readRaw(key);
  if (raw === null) return EMPTY_SNAPSHOT;
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached;
  const items = parseItems(raw);
  const snap: Snapshot = {
    raw,
    items: items.length > 0 ? items : EMPTY_CART,
    qty: new Map(items.map((i) => [i.product_id, i.qty])),
  };
  snapshots.set(key, snap);
  return snap;
}

function write(items: CartItem[], scope?: CartScope): void {
  if (typeof window === "undefined") return;
  const key = cartKey(scope);
  const prevLines = snapshotFor(key).items.length;
  const raw = JSON.stringify(items);
  rawCache.set(key, raw);
  try {
    localStorage.setItem(key, raw);
  } catch {
    // Storage full or blocked: the in-memory copy still works for this visit.
  }
  window.dispatchEvent(
    new CustomEvent<CartChangeDetail>(EVENT_NAME, {
      detail: { key, lines: items.length, prevLines },
    }),
  );
}

// ---- Changes ---------------------------------------------------------

export function getCart(scope?: CartScope): CartItem[] {
  if (typeof window === "undefined") return [];
  return readItems(cartKey(scope));
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
  write(items, scope);
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
  write(next, scope);
  return next;
}

export function removeFromCart(
  productId: string,
  scope?: CartScope,
): CartItem[] {
  return removeManyFromCart([productId], scope);
}

export function removeManyFromCart(
  productIds: string[],
  scope?: CartScope,
): CartItem[] {
  const drop = new Set(productIds);
  const next = getCart(scope).filter((i) => !drop.has(i.product_id));
  write(next, scope);
  return next;
}

/** Put a removed line back where it was (the "Буцаах" on the toast). */
export function restoreCartItem(item: CartItem, index: number, scope?: CartScope): void {
  const items = getCart(scope).filter((i) => i.product_id !== item.product_id);
  items.splice(Math.min(Math.max(index, 0), items.length), 0, item);
  write(items, scope);
}

/** Empty the cart — after an order is sent — and forget its checkout id. */
export function clearCart(scope?: CartScope): void {
  write([], scope);
  try {
    localStorage.removeItem(checkoutKey(scope));
  } catch {
    // ignore
  }
}

/** What the server knows about a product today, to bring a saved cart up to date. */
export type CartProductInfo = {
  price: number;
  category_id: string | null;
  image_url: string | null;
  category_icon?: string | null;
  /** Pieces in stock. ≤ 0 = sold out (a store can't order it). */
  stock?: number;
};

/**
 * Bring a saved cart in line with today's catalog (product_id → info for
 * this store): price, category (deals match on it) and photo, and drop
 * products no longer sold. A cart can sit on a phone for days; without
 * this its total would differ from the order the server actually prices.
 */
export function syncCart(
  catalog: Record<string, CartProductInfo>,
  scope?: CartScope,
): { repriced: number; removed: string[] } {
  const items = getCart(scope);
  let repriced = 0;
  let changed = false;
  const removed: string[] = [];
  const next: CartItem[] = [];
  for (const it of items) {
    const info = catalog[it.product_id];
    if (!info) {
      removed.push(it.name);
      changed = true;
      continue;
    }
    const price = Number(info.price) || 0;
    const updated: CartItem = {
      ...it,
      unit_price: price,
      category_id: info.category_id ?? null,
      image_url: info.image_url ?? null,
      category_icon: info.category_icon ?? it.category_icon ?? null,
    };
    if (Number(it.unit_price) !== price) repriced++;
    if (
      updated.unit_price !== it.unit_price ||
      updated.category_id !== (it.category_id ?? null) ||
      updated.image_url !== (it.image_url ?? null) ||
      updated.category_icon !== (it.category_icon ?? null)
    ) {
      changed = true;
    }
    next.push(updated);
  }
  if (changed) write(next, scope);
  return { repriced, removed };
}

/**
 * Before carts were keyed per shop, a store's cart lived under the bare
 * key. Move it — once — to this shop's key, so the update empties nobody's
 * cart. Safe to call repeatedly.
 */
export function adoptLegacyCart(scope: CartScope): void {
  if (typeof window === "undefined" || !scope.storeId) return;
  const legacy = readRaw(BASE_KEY);
  if (legacy === null) return;
  const hadOwn = getCart(scope).length > 0;
  rawCache.set(BASE_KEY, null);
  try {
    localStorage.removeItem(BASE_KEY);
    localStorage.removeItem(`bdi-checkout-v1:${BASE_KEY}`);
  } catch {
    // ignore
  }
  const items = parseItems(legacy);
  if (!hadOwn && items.length > 0) write(items, scope);
}

export function totalQty(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

export function totalAmount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
}

export { formatMnt } from "./format";

// ---- Hooks (useSyncExternalStore) ------------------------------------
//
// One pair of window listeners for the whole app; components register
// per cart key. Hooks return small snapshots (a number where possible), so
// tapping "+" on one product re-renders that product's card, not all.

const keyListeners = new Map<string, Set<() => void>>();
const anyListeners = new Set<() => void>();
let wired = false;

function notify(key: string | null): void {
  if (key === null) keyListeners.forEach((set) => set.forEach((fn) => fn()));
  else keyListeners.get(key)?.forEach((fn) => fn());
  anyListeners.forEach((fn) => fn());
}

function wire(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener(EVENT_NAME, (e) => {
    const detail = (e as CustomEvent<CartChangeDetail>).detail;
    notify(detail?.key ?? null);
  });
  // Another tab changed a cart.
  window.addEventListener("storage", (e) => {
    if (e.key === null) {
      rawCache.clear();
      notify(null);
      return;
    }
    if (!e.key.startsWith(BASE_KEY)) return;
    rawCache.set(e.key, e.newValue);
    notify(e.key);
  });
  // Back from the browser's page cache: other tabs may have changed the
  // cart meanwhile, without us hearing — read storage again.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    rawCache.clear();
    notify(null);
  });
}

function subscribeKey(key: string, onChange: () => void): () => void {
  wire();
  let set = keyListeners.get(key);
  if (!set) {
    set = new Set();
    keyListeners.set(key, set);
  }
  set.add(onChange);
  return () => {
    set.delete(onChange);
  };
}

function subscribeAny(onChange: () => void): () => void {
  wire();
  anyListeners.add(onChange);
  return () => {
    anyListeners.delete(onChange);
  };
}

const serverEmptyCart = () => EMPTY_CART;
const serverZero = () => 0;

/** The whole cart. Re-renders on any change to it. */
export function useCart(scope?: CartScope): CartItem[] {
  const key = cartKey(scope);
  const subscribe = useCallback((fn: () => void) => subscribeKey(key, fn), [key]);
  const getSnapshot = useCallback(() => snapshotFor(key).items, [key]);
  return useSyncExternalStore(subscribe, getSnapshot, serverEmptyCart);
}

/** How many of one product are in the cart. Re-renders only when that number changes. */
export function useCartQty(productId: string, scope?: CartScope): number {
  const key = cartKey(scope);
  const subscribe = useCallback((fn: () => void) => subscribeKey(key, fn), [key]);
  const getSnapshot = useCallback(
    () => snapshotFor(key).qty.get(productId) ?? 0,
    [key, productId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, serverZero);
}

/** How many different products are in the cart. */
export function useCartLineCount(scope?: CartScope): number {
  const key = cartKey(scope);
  const subscribe = useCallback((fn: () => void) => subscribeKey(key, fn), [key]);
  const getSnapshot = useCallback(() => snapshotFor(key).items.length, [key]);
  return useSyncExternalStore(subscribe, getSnapshot, serverZero);
}

/** Run `onGrow` whenever a new product lands in this cart (not on load). */
export function subscribeCartGrowth(scope: CartScope | undefined, onGrow: () => void): () => void {
  const key = cartKey(scope);
  const handler = (e: Event) => {
    const d = (e as CustomEvent<CartChangeDetail>).detail;
    if (d?.key === key && d.lines > d.prevLines) onGrow();
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

// ---- Every store's cart at once (rep home) ---------------------------

// "id:lines|id:lines" — a string, so the snapshot compares by value.
function storeCartSizesSnapshot(): string {
  const parts: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORE_PREFIX)) continue;
      const lines = snapshotFor(key).items.length;
      if (lines > 0) parts.push(`${key.slice(STORE_PREFIX.length)}:${lines}`);
    }
  } catch {
    // storage blocked: no carts to show
  }
  return parts.sort().join("|");
}

/** How many products sit in each store's cart on this phone (rep flow). */
export function useStoreCartSizes(): Record<string, number> {
  const snap = useSyncExternalStore(subscribeAny, storeCartSizesSnapshot, () => "");
  return useMemo(
    () =>
      Object.fromEntries(
        snap
          ? snap.split("|").map((part) => {
              const cut = part.lastIndexOf(":");
              return [part.slice(0, cut), Number(part.slice(cut + 1))] as const;
            })
          : [],
      ),
    [snap],
  );
}
