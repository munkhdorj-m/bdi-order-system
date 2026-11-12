"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError } from "@/lib/auth";
import { isUuid } from "@/lib/orders/write";

/** Products per request — keeps the `id=in.(…)` URL short. */
const CHUNK = 100;
const MAX_PRODUCTS = 500;
const MAX_STOCK = 10_000_000;

/**
 * Give many products a stock figure at once. A product with stock 0 shows
 * as "Дууссан" and can't be ordered by stores — which is how the products
 * brought over from Mercury arrived (Mercury's own stock isn't kept up).
 */
export async function setStockForProducts(
  productIds: string[],
  stock: number,
): Promise<{ error?: string; count?: number }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const ids = [...new Set((productIds ?? []).filter((id) => isUuid(id)))];
  if (ids.length === 0) return { error: "Бараа сонгоогүй байна." };
  if (ids.length > MAX_PRODUCTS) return { error: `Нэг удаад ${MAX_PRODUCTS} хүртэл бараа.` };
  const value = Math.floor(Number(stock));
  if (!Number.isFinite(value) || value < 0 || value > MAX_STOCK) {
    return { error: "Үлдэгдэл 0-ээс их бүхэл тоо байна." };
  }

  const supabase = await createClient();
  let count = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("products")
      .update({ stock: value })
      .in("id", ids.slice(i, i + CHUNK))
      .select("id");
    if (error) {
      if (count > 0) revalidatePath("/admin/products");
      return { count, error: error.message };
    }
    count += data?.length ?? 0;
  }
  revalidatePath("/admin/products");
  revalidatePath("/admin/mercury");
  revalidatePath("/admin");
  return { count };
}
