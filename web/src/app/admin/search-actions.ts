"use server";

import { createClient } from "@/lib/supabase/server";
import { adminGuardError } from "@/lib/auth";
import type { OrderStatus } from "@/lib/order-status";

export type SearchResults = {
  orders: { id: string; order_number: string; status: OrderStatus; subtotal: number; store: string | null }[];
  stores: { id: string; name: string; detail: string | null; active: boolean }[];
  products: { id: string; name: string; code: string | null; image_url: string | null; active: boolean }[];
};

const EMPTY: SearchResults = { orders: [], stores: [], products: [] };

/**
 * Admin quick search (Ctrl+K): orders by number, stores by name / registry
 * no. / phone / code, products by name / barcode / internal code. A few of
 * each, newest or alphabetical.
 */
export async function adminSearch(raw: string): Promise<SearchResults> {
  if (await adminGuardError()) return EMPTY;
  // Characters with meaning in PostgREST filters can't go in an or() list.
  const term = raw.replace(/[%_,()"\\*]/g, " ").replace(/\s+/g, " ").trim();
  if (term.length < 2) return EMPTY;
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");

  const supabase = await createClient();
  const [orders, stores, products] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, subtotal, supermarkets:supermarket_id(name)")
      // "112" finds ORD-2026-00112.
      .ilike("order_number", digits.length >= 2 && digits.length === term.length ? `%${digits}` : like)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("supermarkets")
      .select("id, name, registry_number, contact_phone, address, active")
      .or(
        [`name.ilike.${like}`, `registry_number.ilike.${like}`, `contact_phone.ilike.${like}`, `external_id.ilike.${like}`].join(","),
      )
      .order("active", { ascending: false })
      .order("name")
      .limit(6),
    supabase
      .from("products")
      .select("id, name, sku, internal_code, image_url, active")
      .or([`name.ilike.${like}`, `sku.ilike.${like}`, `internal_code.ilike.${like}`, `brand.ilike.${like}`].join(","))
      .order("active", { ascending: false })
      .order("name")
      .limit(6),
  ]);

  return {
    orders: ((orders.data ?? []) as unknown as {
      id: string;
      order_number: string;
      status: OrderStatus;
      subtotal: number;
      supermarkets: { name: string } | null;
    }[]).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      subtotal: Number(o.subtotal) || 0,
      store: o.supermarkets?.name ?? null,
    })),
    stores: (stores.data ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      detail: [s.registry_number && `РД ${s.registry_number}`, s.contact_phone, s.address].filter(Boolean).join(" · ") || null,
      active: s.active as boolean,
    })),
    products: (products.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      code: [p.internal_code, p.sku].filter(Boolean).join(" · ") || null,
      image_url: (p.image_url as string | null) ?? null,
      active: p.active as boolean,
    })),
  };
}
