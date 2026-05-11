"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = {
  error?: string;
};

const BUCKET = "product-images";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const str = String(value).trim();
  if (str === "") return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(value: FormDataEntryValue | null): number | null {
  const n = parseNumber(value);
  return n === null ? null : Math.trunc(n);
}

function parseString(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

async function uploadImageIfPresent(formData: FormData): Promise<string | null> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return null;

  const supabase = await createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Зураг хадгалахад алдаа: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function buildPayload(formData: FormData, imageUrl: string | null) {
  const name = parseString(formData.get("name"));
  const sku = parseString(formData.get("sku"));
  const basePrice = parseNumber(formData.get("base_price"));
  if (!name) return { error: "Барааны нэр оруулна уу." };
  if (!sku) return { error: "SKU (бар код) оруулна уу." };
  if (basePrice === null) return { error: "Бөөний үнэ оруулна уу." };

  return {
    payload: {
      name,
      sku,
      category_id: parseString(formData.get("category_id")),
      brand: parseString(formData.get("brand")),
      description: parseString(formData.get("description")),
      unit: parseString(formData.get("unit")),
      pack_size: parseInteger(formData.get("pack_size")),
      box_count: parseInteger(formData.get("box_count")),
      base_price: basePrice,
      cash_price: parseNumber(formData.get("cash_price")),
      stock: parseInteger(formData.get("stock")) ?? 0,
      active: formData.get("active") === "on",
      ...(imageUrl ? { image_url: imageUrl } : {}),
    },
  };
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let imageUrl: string | null = null;
  try {
    imageUrl = await uploadImageIfPresent(formData);
  } catch (err) {
    return { error: (err as Error).message };
  }

  const built = buildPayload(formData, imageUrl);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert(built.payload);
  if (error) return { error: error.message };

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProduct(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let imageUrl: string | null = null;
  try {
    imageUrl = await uploadImageIfPresent(formData);
  } catch (err) {
    return { error: (err as Error).message };
  }

  const built = buildPayload(formData, imageUrl);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update(built.payload)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  redirect("/admin/products");
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}
