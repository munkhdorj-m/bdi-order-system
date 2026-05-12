"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = { error?: string };

function parseString(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function buildPayload(formData: FormData) {
  const name = parseString(formData.get("name"));
  if (!name) return { error: "Дэлгүүрийн нэр оруулна уу." };
  return {
    payload: {
      name,
      type: parseString(formData.get("type")),
      district: parseString(formData.get("district")),
      address: parseString(formData.get("address")),
      contact_phone: parseString(formData.get("contact_phone")),
      assigned_rep_id: parseString(formData.get("assigned_rep_id")),
      price_list_id: parseString(formData.get("price_list_id")),
      notes: parseString(formData.get("notes")),
      active: formData.get("active") === "on",
    },
  };
}

export async function createSupermarket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const built = buildPayload(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase.from("supermarkets").insert(built.payload);
  if (error) return { error: error.message };

  revalidatePath("/admin/supermarkets");
  redirect("/admin/supermarkets");
}

export async function updateSupermarket(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const built = buildPayload(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("supermarkets")
    .update(built.payload)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/supermarkets");
  revalidatePath(`/admin/supermarkets/${id}`);
  redirect("/admin/supermarkets");
}

export async function savePriceList(
  supermarketId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const upserts: { supermarket_id: string; product_id: string; price: number }[] = [];
  const deletes: string[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price_")) continue;
    const productId = key.slice("price_".length);
    const raw = String(value).trim();
    if (raw === "") {
      deletes.push(productId);
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { error: `Үнэ буруу: ${raw}` };
      }
      upserts.push({
        supermarket_id: supermarketId,
        product_id: productId,
        price: n,
      });
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("customer_prices")
      .upsert(upserts, { onConflict: "supermarket_id,product_id" });
    if (error) return { error: error.message };
  }

  if (deletes.length > 0) {
    const { error } = await supabase
      .from("customer_prices")
      .delete()
      .eq("supermarket_id", supermarketId)
      .in("product_id", deletes);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/supermarkets/${supermarketId}/prices`);
  return {};
}
