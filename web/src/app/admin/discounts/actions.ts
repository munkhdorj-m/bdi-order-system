"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { listBuyerIds, notifyMany } from "@/lib/notify";

type ActionState = { error?: string };

async function requireAdmin(): Promise<{ admin: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Нэвтэрнэ үү." };
  if (session.profile.role !== "admin") {
    return { error: "Зөвхөн админ хийх боломжтой." };
  }
  return { admin: true };
}

type DiscountKind = "product" | "threshold_bonus";

function parseString(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function parseNumber(v: FormDataEntryValue | null): number | null {
  const s = parseString(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function parseInteger(v: FormDataEntryValue | null): number | null {
  const n = parseNumber(v);
  return n === null ? null : Math.floor(n);
}

/**
 * Build the discount row payload from the form. Different `kind`s require
 * different fields — we validate them all here so the DB never has to
 * reject a half-formed row.
 */
function buildPayload(
  formData: FormData,
): { payload: Record<string, unknown> } | { error: string } {
  const name = parseString(formData.get("name"));
  const kindRaw = parseString(formData.get("kind"));
  if (!name) return { error: "Нэр оруулна уу." };
  if (kindRaw !== "product" && kindRaw !== "threshold_bonus") {
    return { error: "Хямдралын төрөл буруу." };
  }
  const kind = kindRaw as DiscountKind;

  const active = formData.get("active") === "on";
  const startsAt = parseString(formData.get("starts_at"));
  const endsAt = parseString(formData.get("ends_at"));
  const notes = parseString(formData.get("notes"));

  // kind-specific fields
  const pct = parseNumber(formData.get("pct"));
  const stepAmount = parseNumber(formData.get("step_amount"));
  const bonusN = parseInteger(formData.get("bonus_n"));
  const productId = parseString(formData.get("product_id"));
  const categoryId = parseString(formData.get("category_id"));

  if (kind === "product") {
    if (pct === null || pct < 0 || pct > 100) {
      return { error: "0-100 хооронд хувь оруулна уу." };
    }
  } else {
    // threshold_bonus
    if (stepAmount === null || stepAmount <= 0) {
      return { error: "Босго дүн (₮) оруулна уу." };
    }
    if (bonusN === null || bonusN <= 0) {
      return { error: "Бэлэг ширхэгийг оруулна уу." };
    }
    if (!productId) {
      return { error: "Бэлэг өгөх бараагаа сонгоно уу." };
    }
  }

  return {
    payload: {
      name,
      kind,
      pct: kind === "product" ? pct : null,
      step_amount: kind === "threshold_bonus" ? stepAmount : null,
      // legacy column — never written by the new form, but kept null
      // explicitly so a row insert can't carry stale state from a
      // previous draft of this code.
      step_qty: null,
      bonus_n: kind === "threshold_bonus" ? bonusN : null,
      product_id: productId,
      category_id: kind === "product" ? categoryId : null,
      active,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      notes,
    },
  };
}

export async function createDiscount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const built = buildPayload(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("discounts")
    .insert(built.payload)
    .select("id, name, active")
    .single();
  if (error) return { error: error.message };

  // Only broadcast when the new discount is immediately active. Scheduled
  // (active=false / starts_at in future) discounts are silent until they
  // flip on — admin can manually broadcast later.
  if (row?.active) {
    const buyerIds = await listBuyerIds();
    await notifyMany(buyerIds, {
      kind: "discount_new",
      title: "Шинэ хямдрал",
      body: row.name,
      href: "/catalog",
      discount_id: row.id,
    });
  }

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}

export async function updateDiscount(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const built = buildPayload(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("discounts")
    .update(built.payload)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/discounts");
  revalidatePath(`/admin/discounts/${id}`);
  redirect("/admin/discounts");
}

export async function toggleDiscountActive(
  id: string,
  next: boolean,
): Promise<ActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("discounts")
    .update({ active: next })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/discounts");
  return {};
}

export async function deleteDiscount(id: string): Promise<ActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase.from("discounts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}
