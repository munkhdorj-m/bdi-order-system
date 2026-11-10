"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORES_TAG } from "@/lib/stores";
import { adminGuardError } from "@/lib/auth";

type ActionState = { error?: string };

type DeleteResult = { error?: string };

function parseString(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function buildPayload(formData: FormData) {
  const name = parseString(formData.get("name"));
  if (!name) return { error: "Дэлгүүрийн нэр оруулна уу." };
  // delivery_day: empty string means "use district default" → null in DB.
  // Otherwise parse as ISO weekday 1-7; reject anything else so a stray
  // value can't end up in the column (which has a 1-7 check constraint).
  const rawDay = parseString(formData.get("delivery_day"));
  let delivery_day: number | null = null;
  if (rawDay) {
    const n = Number(rawDay);
    if (!Number.isInteger(n) || n < 1 || n > 7) {
      return { error: "Хүргэлтийн өдөр буруу." };
    }
    delivery_day = n;
  }
  // Tax ids for e-Barimt: no spaces, Cyrillic letters upper-case ("УБ12345678").
  const taxId = (key: string) => {
    const v = parseString(formData.get(key));
    return v ? v.replace(/\s+/g, "").toUpperCase() : null;
  };
  return {
    payload: {
      name,
      type: parseString(formData.get("type")),
      district: parseString(formData.get("district")),
      address: parseString(formData.get("address")),
      contact_phone: parseString(formData.get("contact_phone")),
      assigned_rep_id: parseString(formData.get("assigned_rep_id")),
      price_list_id: parseString(formData.get("price_list_id")),
      delivery_day,
      notes: parseString(formData.get("notes")),
      active: formData.get("active") === "on",
      registry_number: taxId("registry_number"),
      ebarimt_tin: taxId("ebarimt_tin"),
      ebarimt_name: parseString(formData.get("ebarimt_name")),
      external_id: parseString(formData.get("external_id")),
    },
  };
}

/** Friendlier text for the unique Mercury code. */
function saveError(message: string): string {
  if (/external_id/i.test(message) && /duplicate|unique/i.test(message)) {
    return "Ийм Mercury код өөр дэлгүүрт бүртгэлтэй байна.";
  }
  return message;
}

export async function createSupermarket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const built = buildPayload(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase.from("supermarkets").insert(built.payload);
  if (error) return { error: saveError(error.message) };

  updateTag(STORES_TAG);
  revalidatePath("/admin/supermarkets");
  redirect("/admin/supermarkets");
}

export async function updateSupermarket(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const built = buildPayload(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const payload = { ...built.payload };
  // The e-Barimt agent looks the ТТД up from the РД once and keeps it. If
  // the РД changes and the ТТД wasn't edited too, clear it (and the name
  // it came with) so the agent looks it up again instead of billing the
  // old company.
  const { data: before } = await supabase
    .from("supermarkets")
    .select("registry_number, ebarimt_tin")
    .eq("id", id)
    .maybeSingle();
  if (
    before &&
    (before.registry_number ?? null) !== payload.registry_number &&
    (before.ebarimt_tin ?? null) === payload.ebarimt_tin
  ) {
    payload.ebarimt_tin = null;
    payload.ebarimt_name = null;
  }

  const { error } = await supabase
    .from("supermarkets")
    .update(payload)
    .eq("id", id);
  if (error) return { error: saveError(error.message) };

  updateTag(STORES_TAG);
  revalidatePath("/admin/supermarkets");
  revalidatePath(`/admin/supermarkets/${id}`);
  redirect("/admin/supermarkets");
}

export async function deactivateSupermarket(id: string): Promise<void> {
  const guardErr = await adminGuardError();
  if (guardErr) throw new Error(guardErr);

  const supabase = await createClient();
  const { error } = await supabase
    .from("supermarkets")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  updateTag(STORES_TAG);
  revalidatePath("/admin/supermarkets");
  revalidatePath(`/admin/supermarkets/${id}`);
}

export async function deleteSupermarket(id: string): Promise<DeleteResult> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const supabase = await createClient();

  // Check for orders first so we can produce a friendlier message than
  // PostgREST's raw foreign-key error.
  const { count: orderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("supermarket_id", id);
  if ((orderCount ?? 0) > 0) {
    return {
      error: `Энэ дэлгүүрт ${orderCount} захиалга байгаа тул устгах боломжгүй. Идэвхгүй болгох эсвэл захиалгуудыг эхлээд цуцлана уу.`,
    };
  }

  const { error } = await supabase.from("supermarkets").delete().eq("id", id);
  if (error) {
    return { error: `Устгаж чадсангүй: ${error.message}` };
  }

  updateTag(STORES_TAG);
  revalidatePath("/admin/supermarkets");
  redirect("/admin/supermarkets");
}

export async function savePriceList(
  supermarketId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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
