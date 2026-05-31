import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Generic signout endpoint. Sign-out forms in the admin/buyer/rep
 * shells POST here, we clear the Supabase session, then redirect to
 * /login. Independent of how the user originally authenticated.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
