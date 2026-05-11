"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

type ActionState = { error?: string };

const VALID_ROLES = ["admin", "rep", "buyer"] as const;

function parseString(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function updateUser(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const role = parseString(formData.get("role"));
  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    return { error: "Эрх буруу." };
  }

  // Guard: can't demote yourself out of admin (avoids lockout)
  const session = await getSession();
  if (!session) return { error: "Хандах эрхгүй." };
  if (session.userId === id && role !== "admin") {
    return { error: "Өөрийнхөө админ эрхийг хасч болохгүй." };
  }

  const supermarketRaw = parseString(formData.get("supermarket_id"));
  const supermarket_id = role === "buyer" ? supermarketRaw : null;

  const payload = {
    role,
    full_name: parseString(formData.get("full_name")),
    supermarket_id,
    active: formData.get("active") === "on",
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  redirect("/admin/users");
}
