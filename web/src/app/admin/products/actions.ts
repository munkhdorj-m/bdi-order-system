"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError } from "@/lib/auth";

type ActionState = {
  error?: string;
};

const BUCKET = "product-images";

// Uploaded images get resized + re-encoded as WebP before they hit
// Supabase Storage. Two reasons:
//   1. Storage cost — admins routinely upload 3-5MB phone photos.
//      Resizing to 1200px wide + WebP q80 typically drops a 3MB JPEG
//      to ~120-180KB. Across hundreds of products that's 10x savings
//      on Supabase Storage AND on the bandwidth every catalog view
//      consumes.
//   2. Catalog performance — buyers on 3G/4G download these images.
//      Smaller files → faster catalog paint → fewer rage-quits.
//
// 1200px wide is plenty: the largest product card on desktop renders
// at ~280px wide × ~2x DPR = ~560px wide actual pixel target. A 1200px
// source covers all retina cases without being gratuitous.
const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;
const WEBP_QUALITY = 80;

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

  // Run the uploaded buffer through sharp:
  //   - `fit: "inside"` resizes to fit inside the bounding box while
  //     preserving aspect ratio. Smaller images aren't enlarged
  //     (withoutEnlargement) so we don't waste pixels on already-small
  //     uploads.
  //   - `rotate()` auto-orients based on EXIF — phone photos taken in
  //     portrait often arrive sideways without this.
  //   - WebP at q80 is the sweet spot for product photography; q90+
  //     gives diminishing returns and dramatically larger files.
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let optimized: Buffer;
  try {
    optimized = await sharp(inputBuffer)
      .rotate()
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (e) {
    // If sharp can't decode (HEIC the system doesn't support, corrupted
    // upload, etc.) fall back to the raw bytes — better to land a
    // bigger image than reject the upload entirely. Server log captures
    // the issue so we can chase HEIC support if it becomes common.
    console.warn("[uploadImageIfPresent] sharp failed, using raw bytes:", e);
    optimized = inputBuffer;
  }

  const supabase = await createClient();
  // Always store as .webp regardless of original extension — the
  // pipeline above guarantees the output is WebP unless sharp failed,
  // and even in the failure case modern browsers handle a .webp file
  // extension on any image MIME type without issue.
  const usedSharp = optimized !== inputBuffer;
  const ext = usedSharp ? "webp" : file.name.split(".").pop() || "jpg";
  const contentType = usedSharp ? "image/webp" : file.type;
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, optimized, {
      contentType,
      upsert: false,
      // Year-long cache — these are content-addressed by random UUID
      // so the URL never reuses bytes, meaning long caching is safe
      // and saves bandwidth on the CDN layer downstream.
      cacheControl: "31536000",
    });
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
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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
  const guardErr = await adminGuardError();
  if (guardErr) throw new Error(guardErr);

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}
