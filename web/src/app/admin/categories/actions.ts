"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError } from "@/lib/auth";
import { isCategoryIconKey } from "@/lib/category-visual";

/**
 * Category management (/admin/categories) and moving products between
 * categories (/admin/products). Admin-only; RLS also limits writes to
 * admins (categories_admin_write, products_admin_write).
 */

type Result = { error?: string };

function refresh() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/admin/orders/new");
  revalidatePath("/catalog");
}

function cleanName(raw: unknown): string | { error: string } {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) return { error: "Ангиллын нэр оруулна уу." };
  if (name.length > 60) return { error: "Нэр 60 тэмдэгтээс урт байна." };
  return name;
}

function dbError(e: { code?: string; message: string }): string {
  if (e.code === "23505") return "Ийм нэртэй ангилал аль хэдийн байна.";
  return e.message;
}

export async function createCategory(input: { name: string; icon: string | null }): Promise<Result & { id?: string }> {
  const guard = await adminGuardError();
  if (guard) return { error: guard };
  const name = cleanName(input.name);
  if (typeof name !== "string") return name;
  const icon = isCategoryIconKey(input.icon) ? input.icon : null;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name, icon, sort_order: (Number(last?.sort_order) || 0) + 1 })
    .select("id")
    .single();
  if (error) return { error: dbError(error) };
  refresh();
  return { id: data.id as string };
}

export async function updateCategory(
  id: string,
  patch: { name?: string; icon?: string | null },
): Promise<Result> {
  const guard = await adminGuardError();
  if (guard) return { error: guard };
  const row: { name?: string; icon?: string | null } = {};
  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    if (typeof name !== "string") return name;
    row.name = name;
  }
  if (patch.icon !== undefined) {
    if (patch.icon !== null && !isCategoryIconKey(patch.icon)) return { error: "Тодорхойгүй зураг." };
    row.icon = patch.icon;
  }
  if (Object.keys(row).length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update(row).eq("id", id);
  if (error) return { error: dbError(error) };
  refresh();
  return {};
}

/** Move one place up or down. Renumbers the whole (short) list 1…n. */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<Result> {
  const guard = await adminGuardError();
  if (guard) return { error: guard };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, sort_order")
    .order("sort_order")
    .order("name");
  if (error) return { error: error.message };
  const ids = (data ?? []).map((c) => c.id as string);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return {};
  [ids[from], ids[to]] = [ids[to], ids[from]];

  const current = new Map((data ?? []).map((c) => [c.id as string, Number(c.sort_order)]));
  for (const [i, cid] of ids.entries()) {
    if (current.get(cid) === i + 1) continue;
    const { error: upErr } = await supabase.from("categories").update({ sort_order: i + 1 }).eq("id", cid);
    if (upErr) return { error: upErr.message };
  }
  refresh();
  return {};
}

/**
 * Only an empty category can go: products must be moved first, and a deal
 * aimed at the category would be deleted with it (on delete cascade).
 */
export async function deleteCategory(id: string): Promise<Result> {
  const guard = await adminGuardError();
  if (guard) return { error: guard };
  const supabase = await createClient();
  const [{ count: products }, { count: deals }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id),
    supabase.from("discounts").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);
  if ((products ?? 0) > 0) {
    return { error: `Энэ ангилалд ${products} бараа байна. Эхлээд тэдгээрийг өөр ангилал руу шилжүүлнэ үү.` };
  }
  if ((deals ?? 0) > 0) {
    return { error: "Энэ ангилалд хямдрал холбогдсон байна. Хямдралыг өөрчилсний дараа устгана уу." };
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** Put one product in a category (null = none). */
export async function setProductCategory(productId: string, categoryId: string | null): Promise<Result> {
  const guard = await adminGuardError();
  if (guard) return { error: guard };
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ category_id: categoryId || null })
    .eq("id", productId);
  if (error) return { error: error.message };
  refresh();
  return {};
}
