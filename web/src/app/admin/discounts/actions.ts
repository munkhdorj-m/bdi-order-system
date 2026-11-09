"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { adminGuardError } from "@/lib/auth";
import { notifyMany } from "@/lib/notify";
import { parseUbDateTimeInput } from "@/lib/dispatch";

type ActionState = { error?: string };

type DiscountKind = "product" | "threshold_bonus";
type TargetMode = "all" | "include" | "exclude";

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
  // The form's datetime-local values are Ulaanbaatar time. Parsed on the
  // (UTC) server without an offset they used to land 8 hours late.
  const startsAt = parseUbDateTimeInput(parseString(formData.get("starts_at")));
  const endsAt = parseUbDateTimeInput(parseString(formData.get("ends_at")));
  if (startsAt === null || endsAt === null) {
    return { error: "Эхлэх / дуусах огноо буруу байна." };
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: "Дуусах хугацаа эхлэхээс хойш байх ёстой." };
  }
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

  // Store targeting (fix 30). include/exclude must name at least one
  // price list — an empty include would apply nowhere (surely a mistake)
  // and an empty exclude is just 'all' in disguise.
  const targetModeRaw = parseString(formData.get("target_mode")) ?? "all";
  if (
    targetModeRaw !== "all" &&
    targetModeRaw !== "include" &&
    targetModeRaw !== "exclude"
  ) {
    return { error: "Хамрах хүрээний горим буруу." };
  }
  const targetListIds =
    targetModeRaw === "all"
      ? []
      : formData
          .getAll("target_price_list_ids")
          .map((v) => String(v).trim())
          .filter(Boolean);
  if (targetModeRaw !== "all" && targetListIds.length === 0) {
    return {
      error: "Дор хаяж нэг үнийн жагсаалт сонгоно уу (эсвэл «Бүх дэлгүүр»).",
    };
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
      starts_at: startsAt ?? null,
      ends_at: endsAt ?? null,
      notes,
      target_mode: targetModeRaw,
      target_price_list_ids: targetListIds,
    },
  };
}

export async function createDiscount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const built = buildPayload(formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("discounts")
    .insert(built.payload)
    .select("id, name, active, starts_at, ends_at, target_mode, target_price_list_ids")
    .single();
  if (error) return { error: error.message };

  // Tell the stores only when the deal is on right now (a scheduled or
  // switched-off one stays quiet), only the stores it applies to, and
  // after the response — the admin doesn't wait for every push.
  const now = Date.now();
  const liveNow =
    row.active &&
    (!row.starts_at || Date.parse(row.starts_at) <= now) &&
    (!row.ends_at || Date.parse(row.ends_at) > now);
  if (liveNow) {
    const mode = (row.target_mode ?? "all") as TargetMode;
    const lists = (row.target_price_list_ids ?? []) as string[];
    after(async () => {
      try {
        const recipients = await discountRecipients(mode, lists);
        await notifyMany(recipients, {
          kind: "discount_new",
          title: "Шинэ хямдрал",
          body: row.name as string,
          href: "/catalog",
          discount_id: row.id as string,
        });
      } catch (e) {
        console.error("[discounts] broadcast failed:", e);
      }
    });
  }

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}

/**
 * Active store users whose store the deal applies to: every store for
 * "all", stores on a chosen price list for "include", the rest (stores
 * with no price list too) for "exclude". Users without a store are skipped.
 */
async function discountRecipients(mode: TargetMode, listIds: string[]): Promise<string[]> {
  const admin = createAdminClient();
  const rows = await fetchAll<{ id: string; store: { price_list_id: string | null } | null }>(() =>
    admin
      .from("profiles")
      .select("id, store:supermarket_id(price_list_id)")
      .eq("role", "buyer")
      .eq("active", true)
      .not("supermarket_id", "is", null)
      .order("id"),
  );
  const chosen = new Set(listIds);
  return rows
    .filter((r) => {
      if (!r.store) return false;
      const list = r.store.price_list_id;
      if (mode === "include") return list !== null && chosen.has(list);
      if (mode === "exclude") return list === null || !chosen.has(list);
      return true;
    })
    .map((r) => r.id);
}

export async function updateDiscount(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

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

export async function deleteDiscount(id: string): Promise<ActionState> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };

  const supabase = await createClient();
  const { error } = await supabase.from("discounts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}
