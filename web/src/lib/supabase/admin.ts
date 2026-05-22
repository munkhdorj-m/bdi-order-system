import { createClient } from "@supabase/supabase-js";

/**
 * Admin client that uses the service_role key. This bypasses RLS entirely.
 * ONLY use this on the server side for operations that authenticated users
 * need to perform but RLS doesn't allow (e.g., buyer deleting their own order).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
