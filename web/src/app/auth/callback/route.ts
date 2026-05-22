import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapAuthError } from "@/lib/auth";

/**
 * Email-link landing route for Supabase auth flows.
 *
 * Supabase appends a `type` query param to every email link
 * (`signup` | `recovery` | `invite` | `magiclink` | `email_change`). We
 * exchange the code for a session, then route by `type`:
 *   - signup  → "/" (let the root layout figure out where they belong)
 *   - recovery → "/reset-password" (user wants to set a new password)
 *   - everything else → "/login"
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type") ?? "";
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(mapAuthError(errorDescription, "callback"))}`,
        request.url,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(mapAuthError("missing-code", "callback"))}`,
        request.url,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(mapAuthError(error, "callback"))}`,
        request.url,
      ),
    );
  }

  // Route by the email-link type. Default = recovery for backwards compat
  // with any in-flight password-reset emails sent before the type-aware
  // version of this route shipped.
  if (type === "signup" || type === "magiclink" || type === "invite") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL("/reset-password", request.url));
}
