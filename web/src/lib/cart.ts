"use client";

import { useEffect, useState } from "react";

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
    existing.name = item.name;
    existing.brand = item.brand;
    existing.image_url = item.image_url;
    existing.category_id = item.category_id ?? existing.category_id ?? null;
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

export function totalQty(items?: CartItem[]): number {
  return (items ?? getCart()).reduce((sum, i) => sum + i.qty, 0);
}

export function totalAmount(items?: CartItem[]): number {
  return (items ?? getCart()).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
}

export { formatMnt } from "./format";

export function useCart(scope?: CartScope): CartItem[] {
  const [items, setItems] = useState<CartItem[]>([]);
  const scopedKey = scope?.storeId ?? "";

  useEffect(() => {
    setItems(getCart(scope));
    const refresh = (e?: Event) => {
      // Only refresh if the change was for our scope (or storage event from another tab)
      const detail = (e as CustomEvent | undefined)?.detail as
        | { key?: string }
        | undefined;
      if (detail?.key && detail.key !== keyFor(scope)) return;
      setItems(getCart(scope));
    };
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey]);

  return items;
}
