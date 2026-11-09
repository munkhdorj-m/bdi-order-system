"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { adminGuardError } from "@/lib/auth";

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
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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
  const guardErr = await adminGuardError();
  if (guardErr) throw new Error(guardErr);

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
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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

export type AssignCandidate = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  /** The list the store uses now (null = base prices). */
  currentListId: string | null;
  currentListName: string | null;
};

/** Search words: letters/digits only — no LIKE or PostgREST wildcards. */
function cleanKeywords(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.replace(/[%_*"'\\(),.:;]/g, " ").replace(/\s+/g, " ").trim())
        .filter((s) => s.length >= 2),
    ),
  ].slice(0, 10);
}

/**
 * Step 1 of bulk assignment: which stores match the words. Nothing is
 * written here — the admin reviews the list, unticks what doesn't belong
 * and confirms (step 2). Store names only by default; address/notes on
 * request, since addresses often name a landmark ("Номины хажууд").
 */
export async function previewPriceListMatches(
  priceListId: string,
  input: { keywords: string; address: boolean; notes: boolean },
): Promise<{ stores?: AssignCandidate[]; error?: string }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const keywords = cleanKeywords(String(input.keywords ?? ""));
  if (keywords.length === 0) {
    return { error: "2-оос дээш үсэгтэй түлхүүр үг оруулна уу (жишээ нь: Nomin, Номин)." };
  }
  const columns = ["name", ...(input.address ? ["address"] : []), ...(input.notes ? ["notes"] : [])];

  const supabase = await createClient();
  type Row = {
    id: string;
    name: string;
    address: string | null;
    active: boolean;
    price_list_id: string | null;
    list: { name: string } | null;
  };
  try {
    const parts = await Promise.all(
      keywords.flatMap((kw) =>
        columns.map((col) =>
          fetchAll<Row>(() =>
            supabase
              .from("supermarkets")
              .select("id, name, address, active, price_list_id, list:price_list_id(name)")
              .ilike(col, `%${kw}%`)
              .order("id"),
          ),
        ),
      ),
    );
    const byId = new Map<string, Row>();
    for (const r of parts.flat()) byId.set(r.id, r);
    const stores = [...byId.values()]
      .map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        active: r.active,
        currentListId: r.price_list_id,
        currentListName: r.price_list_id === priceListId ? null : (r.list?.name ?? null),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "mn"));
    return { stores };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Step 2: put exactly the stores the admin confirmed on this list. */
export async function assignPriceListToStores(
  priceListId: string,
  storeIds: string[],
): Promise<{ count?: number; error?: string }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const ids = [...new Set((storeIds ?? []).filter((x) => typeof x === "string" && x))];
  if (ids.length === 0) return { error: "Дэлгүүр сонгоно уу." };

  const supabase = await createClient();
  let count = 0;
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from("supermarkets")
      .update({ price_list_id: priceListId })
      .in("id", ids.slice(i, i + 150))
      .select("id");
    if (error) return { count, error: error.message };
    count += data?.length ?? 0;
  }

  revalidatePath(`/admin/price-lists/${priceListId}`);
  revalidatePath("/admin/price-lists");
  revalidatePath("/admin/supermarkets");
  return { count };
}

export async function unassignStore(storeId: string, priceListId: string): Promise<void> {
  const guardErr = await adminGuardError();
  if (guardErr) throw new Error(guardErr);

  const supabase = await createClient();
  const { error } = await supabase
    .from("supermarkets")
    .update({ price_list_id: null })
    .eq("id", storeId)
    .eq("price_list_id", priceListId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/price-lists/${priceListId}`);
  revalidatePath("/admin/price-lists");
}
