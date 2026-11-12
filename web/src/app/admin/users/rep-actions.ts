"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminGuardError } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { STORES_TAG } from "@/lib/stores";
import { isUuid } from "@/lib/orders/write";
import { FIX_43_HINT, needsFix43 } from "@/lib/orders/correct";

/**
 * Setting a sales rep up to work from the website instead of Mercury:
 * which stores are theirs (a rep only sees and orders for assigned
 * stores), and whether they are also the delivery person (Түгээгч) who
 * sees their delivery runs on the phone.
 */

type Result = { error?: string; count?: number };

/** Store ids per request — keeps the `in.(…)` URL short. */
const CHUNK = 100;

async function activeRep(userId: string): Promise<string | null> {
  if (!isUuid(userId)) return "Хэрэглэгч олдсонгүй.";
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role, active").eq("id", userId).maybeSingle();
  if (!data) return "Хэрэглэгч олдсонгүй.";
  if (data.role !== "rep") return "Зөвхөн «Төлөөлөгч» эрхтэй хэрэглэгчид дэлгүүр оноодог. Эхлээд эрхийг нь солиод хадгална уу.";
  if (!data.active) return "Хэрэглэгч идэвхгүй байна.";
  return null;
}

function refresh(userId: string) {
  updateTag(STORES_TAG);
  revalidatePath("/admin/supermarkets");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/mercury");
}

/** Who looks after each customer in Mercury ("Менежер"): name → Mercury customer ids. */
export async function mercuryManagers(): Promise<{ managers?: { name: string; customers: number }[]; error?: string }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  try {
    const byManager = await loadManagers();
    return {
      managers: [...byManager]
        .map(([name, keys]) => ({ name, customers: keys.length }))
        .sort((a, b) => b.customers - a.customers),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function loadManagers(): Promise<Map<string, string[]>> {
  // Service role: the mirror is big and admin-only; the caller is checked above.
  const admin = createAdminClient();
  const rows = await fetchAll<{ mercury_key: string; manager: string | null }>(() =>
    admin
      .from("mercury_records")
      .select("mercury_key, manager:data->>Менежер")
      .eq("entity", "customer")
      .order("mercury_key"),
  );
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const name = (r.manager ?? "").trim();
    if (!name) continue;
    const list = out.get(name);
    if (list) list.push(r.mercury_key);
    else out.set(name, [r.mercury_key]);
  }
  return out;
}

/**
 * Give a rep the stores one Mercury manager looks after. `onlyUnassigned`
 * leaves stores that already have a rep alone.
 */
export async function assignStoresByMercuryManager(
  userId: string,
  manager: string,
  onlyUnassigned: boolean,
): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const repErr = await activeRep(userId);
  if (repErr) return { error: repErr };

  let keys: string[];
  try {
    keys = (await loadManagers()).get(manager.trim()) ?? [];
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (keys.length === 0) return { error: "Mercury дээр ийм менежертэй харилцагч олдсонгүй." };

  const supabase = await createClient();
  let count = 0;
  for (let i = 0; i < keys.length; i += CHUNK) {
    let q = supabase
      .from("supermarkets")
      .update({ assigned_rep_id: userId })
      .in("external_id", keys.slice(i, i + CHUNK));
    if (onlyUnassigned) q = q.is("assigned_rep_id", null);
    const { data, error } = await q.select("id");
    if (error) {
      if (count > 0) refresh(userId);
      return { count, error: error.message };
    }
    count += data?.length ?? 0;
  }
  refresh(userId);
  return { count };
}

/** Give a rep every active store (a small team where one person visits everyone). */
export async function assignAllStores(userId: string, onlyUnassigned: boolean): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const repErr = await activeRep(userId);
  if (repErr) return { error: repErr };

  const supabase = await createClient();
  let q = supabase.from("supermarkets").update({ assigned_rep_id: userId }).eq("active", true);
  q = onlyUnassigned ? q.is("assigned_rep_id", null) : q.or(`assigned_rep_id.is.null,assigned_rep_id.neq.${userId}`);
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  refresh(userId);
  return { count: data?.length ?? 0 };
}

/** Take every store away from a rep (they stay in the system, unassigned). */
export async function unassignRepStores(userId: string): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  if (!isUuid(userId)) return { error: "Хэрэглэгч олдсонгүй." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supermarkets")
    .update({ assigned_rep_id: null })
    .eq("assigned_rep_id", userId)
    .select("id");
  if (error) return { error: error.message };
  refresh(userId);
  return { count: data?.length ?? 0 };
}

/**
 * Link a login to a delivery person (or unlink with null). The user then
 * sees that Түгээгч's delivery runs at /rep/delivery. Needs fix 43.
 */
export async function linkDistributor(userId: string, distributorId: string | null): Promise<Result> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  if (!isUuid(userId)) return { error: "Хэрэглэгч олдсонгүй." };
  if (distributorId !== null && !isUuid(distributorId)) return { error: "Түгээгч олдсонгүй." };
  if (distributorId) {
    const repErr = await activeRep(userId);
    if (repErr) return { error: repErr };
  }

  const supabase = await createClient();
  // One login, one delivery person: free whatever this login had first.
  const { error: clearErr } = await supabase.from("distributors").update({ profile_id: null }).eq("profile_id", userId);
  if (clearErr) return { error: needsFix43(clearErr) ? FIX_43_HINT : clearErr.message };
  if (distributorId) {
    const { data, error } = await supabase
      .from("distributors")
      .update({ profile_id: userId })
      .eq("id", distributorId)
      .is("profile_id", null)
      .select("id");
    if (error) return { error: needsFix43(error) ? FIX_43_HINT : error.message };
    if (!data?.length) return { error: "Энэ түгээгч өөр хэрэглэгчтэй холбогдсон байна." };
  }
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/mercury");
  revalidatePath("/rep", "layout");
  return {};
}
