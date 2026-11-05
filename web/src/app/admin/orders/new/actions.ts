"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError, getSession } from "@/lib/auth";
import { isPaymentMethod, type PaymentMethod } from "@/lib/payment-method";
import { isIsoDay } from "@/lib/dispatch";
import { resolveDeliveryDay } from "@/lib/delivery";

/**
 * Admin enters an order on a store's behalf (phone orders, reps' orders) —
 * Mercury's "Нэмэх". Prices come from the store's own price list via the
 * supermarket_prices view, re-read on save so the client can't set them.
 * No automatic discounts: like Mercury, staff-entered orders bill at the
 * store's list price.
 */

export type CatalogRow = {
  product_id: string;
  name: string;
  sku: string | null;
  internal_code: string | null;
  category_id: string | null;
  price: number;
  price_source: string;
  stock: number;
  unit: string | null;
  box_count: number | null;
  image_url: string | null;
};

export type StoreSummary = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  registry_number: string | null;
  price_list: string | null;
  /** ISO weekday of the store's scheduled delivery, if any. */
  delivery_weekday: number | null;
};

export async function loadStoreCatalog(
  storeId: string,
): Promise<{ rows?: CatalogRow[]; store?: StoreSummary; error?: string }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  if (!storeId) return { error: "Дэлгүүр сонгоно уу." };

  const supabase = await createClient();
  const [prices, products, store] = await Promise.all([
    supabase
      .from("supermarket_prices")
      .select("product_id, name, sku, category_id, effective_price, price_source, stock, unit, box_count, image_url")
      .eq("supermarket_id", storeId),
    supabase.from("products").select("id, internal_code, active"),
    supabase
      .from("supermarkets")
      .select("id, name, address, contact_phone, registry_number, district, delivery_day, price_lists:price_list_id(name)")
      .eq("id", storeId)
      .single(),
  ]);
  if (prices.error) return { error: prices.error.message };
  if (store.error || !store.data) return { error: "Дэлгүүр олдсонгүй." };

  const meta = new Map((products.data ?? []).map((p) => [p.id as string, p]));
  const rows: CatalogRow[] = (prices.data ?? [])
    .filter((p) => meta.get(p.product_id as string)?.active !== false)
    .map((p) => ({
      product_id: p.product_id as string,
      name: p.name as string,
      sku: (p.sku as string | null) ?? null,
      internal_code: (meta.get(p.product_id as string)?.internal_code as string | null) ?? null,
      category_id: (p.category_id as string | null) ?? null,
      price: Number(p.effective_price) || 0,
      price_source: p.price_source as string,
      stock: Number(p.stock) || 0,
      unit: (p.unit as string | null) ?? null,
      box_count: (p.box_count as number | null) ?? null,
      image_url: (p.image_url as string | null) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "mn", { numeric: true }));

  const s = store.data as unknown as {
    id: string;
    name: string;
    address: string | null;
    contact_phone: string | null;
    registry_number: string | null;
    district: string | null;
    delivery_day: number | null;
    price_lists: { name: string } | null;
  };
  return {
    rows,
    store: {
      id: s.id,
      name: s.name,
      address: s.address,
      contact_phone: s.contact_phone,
      registry_number: s.registry_number,
      price_list: s.price_lists?.name ?? null,
      delivery_weekday: resolveDeliveryDay({ storeDeliveryDay: s.delivery_day, district: s.district }),
    },
  };
}

export type CreateOrderInput = {
  storeId: string;
  items: { product_id: string; qty: number }[];
  paymentMethod: string;
  deliveryDate: string | null;
  notes: string | null;
};

export async function createOrderForStore(
  input: CreateOrderInput,
): Promise<{ orderId?: string; orderNumber?: string; error?: string }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const session = await getSession();
  if (!session) return { error: "Нэвтэрнэ үү." };
  if (!input.storeId) return { error: "Дэлгүүр сонгоно уу." };

  // Merge duplicate lines, whole pieces only.
  const qtyById = new Map<string, number>();
  for (const i of input.items ?? []) {
    const qty = Math.floor(Number(i.qty));
    if (!i.product_id || !Number.isFinite(qty) || qty <= 0) continue;
    qtyById.set(i.product_id, (qtyById.get(i.product_id) ?? 0) + qty);
  }
  if (qtyById.size === 0) return { error: "Бараа нэмнэ үү." };
  if (qtyById.size > 300) return { error: "Нэг захиалгад 300-аас олон бараа оруулах боломжгүй." };

  const paymentMethod: PaymentMethod = isPaymentMethod(input.paymentMethod) ? input.paymentMethod : "credit";
  const deliveryDate = isIsoDay(input.deliveryDate) ? input.deliveryDate : null;
  const notes = input.notes?.trim() ? input.notes.trim().slice(0, 1000) : null;

  const supabase = await createClient();
  const { data: priced, error: priceErr } = await supabase
    .from("supermarket_prices")
    .select("product_id, name, effective_price")
    .eq("supermarket_id", input.storeId)
    .in("product_id", [...qtyById.keys()]);
  if (priceErr) return { error: priceErr.message };
  const priceById = new Map((priced ?? []).map((p) => [p.product_id as string, p]));
  if (priceById.size !== qtyById.size) {
    return { error: "Зарим бараа олдсонгүй. Хуудсаа сэргээгээд дахин оролдоно уу." };
  }

  const { data: numberRow, error: numErr } = await supabase.rpc("generate_order_number");
  if (numErr) return { error: numErr.message };
  const orderNumber = numberRow as unknown as string;

  const now = new Date().toISOString();
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      supermarket_id: input.storeId,
      placed_by: session.userId,
      status: "confirmed",
      confirmed_at: now,
      payment_method: paymentMethod,
      discount_total: 0,
      delivery_date: deliveryDate,
      notes,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) {
    return { error: orderErr?.message ?? "Захиалга үүсгэж чадсангүй." };
  }

  const { error: itemsErr } = await supabase.from("order_items").insert(
    [...qtyById].map(([productId, qty]) => {
      const p = priceById.get(productId)!;
      return {
        order_id: order.id,
        product_id: productId,
        product_name_snapshot: p.name as string,
        qty,
        unit_price: Number(p.effective_price) || 0,
      };
    }),
  );
  if (itemsErr) {
    // Don't leave an empty order behind.
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: itemsErr.message };
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin");
  return { orderId: order.id as string, orderNumber: order.order_number as string };
}
