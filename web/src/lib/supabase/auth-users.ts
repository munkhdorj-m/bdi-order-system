import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { phoneVariants } from "@/lib/sms/verify-mn";

const PAGE_SIZE = 1000;
/** Safety stop: 50 pages = 50,000 accounts. */
const MAX_PAGES = 50;

/**
 * The auth user that owns `phone` (either stored shape), or null.
 *
 * Supabase has no "get user by phone" admin call, so this pages through
 * listUsers. Reading only the first page silently missed every account
 * past the first 1,000. Only used on rare paths (admin creating an
 * account, recovering a half-finished sign-up), never per request.
 */
export async function findAuthUserIdByPhone(
  admin: SupabaseClient,
  phone: string,
): Promise<string | null> {
  const wanted = new Set(phoneVariants(phone));
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users ?? [];
    const hit = users.find((u) => u.phone && wanted.has(u.phone));
    if (hit) return hit.id;
    if (users.length < PAGE_SIZE) return null;
  }
  return null;
}
