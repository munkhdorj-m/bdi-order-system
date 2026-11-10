import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PUSH_DEVICE_COOKIE } from "@/lib/push";

/**
 * Generic signout endpoint. Sign-out forms in the admin/buyer/rep
 * shells POST here, we clear the Supabase session, then redirect to
 * /login. Independent of how the user originally authenticated.
 *
 * This device's push subscription goes too (only this device's — the
 * user's other phones keep alerting). Without that, a shared shop tablet
 * kept receiving the previous user's notifications after sign-out.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const store = await cookies();

  const deviceSub = store.get(PUSH_DEVICE_COOKIE)?.value;
  if (deviceSub && /^[0-9a-f-]{36}$/i.test(deviceSub)) {
    // Before signOut: RLS lets a user delete only their own rows.
    const { error } = await supabase.from("push_subscriptions").delete().eq("id", deviceSub);
    if (error) console.error("[signout] push subscription delete failed:", error.message);
    store.delete(PUSH_DEVICE_COOKIE);
  }

  // "local": end THIS device's session only. The default ("global") ends
  // the account's sessions everywhere — a shop's second phone, the office
  // desktop — which signed people out for no reason they could see.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
