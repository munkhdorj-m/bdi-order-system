import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Generic signout endpoint. Sign-out forms in headers and the
 * inactive/pending pages POST here, then we redirect to /login.
 *
 * Kept under `/auth/` even though every other email-only auth route
 * was removed — this one is just a session-clear and is shared by
 * phone, OAuth, anything else Supabase might support later.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
