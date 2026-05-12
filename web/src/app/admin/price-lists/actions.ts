"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = { error?: string; ok?: boolean };

function parseString(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function buildMeta(formData: FormData) {
  const name = parseString(formData.get("name"));
  if (!name) return { error: "Жагсаалтын нэр оруулна уу." };
  return {
    payload: {
      name,
      description: parseString(formData.get("description")),
      active: formData.get("active") === "on",
    },
  };
}

export async function createPriceList(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const built = buildMeta(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_lists")
    .insert(built.payload)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin/price-lists");
  redirect(`/admin/price-lists/${data!.id}`);
}

export async function updatePriceList(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const built = buildMeta(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("price_lists")
    .update(built.payload)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/price-lists");
  revalidatePath(`/admin/price-lists/${id}`);
  return { ok: true };
}

export async function deletePriceList(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("price_lists").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/price-lists");
  redirect("/admin/price-lists");
}

export async function savePriceListItems(
  priceListId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();

  const upserts: { price_list_id: string; product_id: string; price: number }[] = [];
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
        price_list_id: priceListId,
        product_id: productId,
        price: n,
      });
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("price_list_items")
      .upsert(upserts, { onConflict: "price_list_id,product_id" });
    if (error) return { error: error.message };
  }

  if (deletes.length > 0) {
    const { error } = await supabase
      .from("price_list_items")
      .delete()
      .eq("price_list_id", priceListId)
      .in("product_id", deletes);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/price-lists/${priceListId}`);
  return { ok: true };
}

/**
 * Bulk-assign this price list to every store whose name/notes/address
 * contains any of the comma-separated keywords. Useful for big chains:
 * type "Nomin, Номин" → every Nomin branch points at this list.
 */
export async function autoAssignByKeyword(
  priceListId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = parseString(formData.get("keywords"));
  if (!raw) return { error: "Түлхүүр үг оруулна уу (жишээ нь: Nomin, Номин)" };

  const keywords = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (keywords.length === 0) return { error: "Түлхүүр үг хоосон байна." };

  const supabase = await createClient();

  // Build an OR filter: name ilike '%kw1%' OR notes ilike '%kw1%' OR ...
  const orParts: string[] = [];
  for (const kw of keywords) {
    const escaped = kw.replace(/[%_,()]/g, "");
    if (!escaped) continue;
    orParts.push(
      `name.ilike.%${escaped}%`,
      `notes.ilike.%${escaped}%`,
      `address.ilike.%${escaped}%`,
    );
  }
  if (orParts.length === 0) return { error: "Хүчинтэй түлхүүр үг алга." };

  const { error, count } = await supabase
    .from("supermarkets")
    .update({ price_list_id: priceListId }, { count: "exact" })
    .or(orParts.join(","));
  if (error) return { error: error.message };

  revalidatePath(`/admin/price-lists/${priceListId}`);
  revalidatePath("/admin/supermarkets");
  return { ok: true, error: `${count ?? 0} дэлгүүрт оноогдлоо.` };
}

export async function unassignStore(
  storeId: string,
  redirectTo: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("supermarkets")
    .update({ price_list_id: null })
    .eq("id", storeId);
  if (error) throw new Error(error.message);
  revalidatePath(redirectTo);
}
