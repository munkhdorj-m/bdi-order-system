"use client";

import { useEffect, useState } from "react";

export type CartItem = {
  product_id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  unit_price: number;
  qty: number;
};

const STORAGE_KEY = "bdi-cart-v1";
const EVENT_NAME = "bdi-cart-change";

function safeRead(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getCart(): CartItem[] {
  return safeRead();
}

export function addToCart(
  item: Omit<CartItem, "qty">,
  qty: number = 1,
): CartItem[] {
  if (qty <= 0) return getCart();
  const items = getCart();
  const existing = items.find((i) => i.product_id === item.product_id);
  if (existing) {
    existing.qty += qty;
    // Refresh snapshot fields in case price/name changed since first add
    existing.unit_price = item.unit_price;
    existing.name = item.name;
    existing.brand = item.brand;
    existing.image_url = item.image_url;
  } else {
    items.push({ ...item, qty });
  }
  safeWrite(items);
  return items;
}

export function updateQty(productId: string, qty: number): CartItem[] {
  const next = qty <= 0
    ? getCart().filter((i) => i.product_id !== productId)
    : getCart().map((i) =>
        i.product_id === productId ? { ...i, qty: Math.floor(qty) } : i,
      );
  safeWrite(next);
  return next;
}

export function removeFromCart(productId: string): CartItem[] {
  const next = getCart().filter((i) => i.product_id !== productId);
  safeWrite(next);
  return next;
}

export function clearCart(): void {
  safeWrite([]);
}

export function totalQty(items?: CartItem[]): number {
  return (items ?? getCart()).reduce((sum, i) => sum + i.qty, 0);
}

export function totalAmount(items?: CartItem[]): number {
  return (items ?? getCart()).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
}

export { formatMnt } from "./format";

export function useCart(): CartItem[] {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
    const refresh = () => setItems(getCart());
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return items;
}
