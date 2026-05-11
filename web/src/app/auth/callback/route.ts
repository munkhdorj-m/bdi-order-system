import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription)}`, request.url),
    );
  }

  const supabase = await createClient();

  if (tokenHash && typeParam) {
    const type = ALLOWED_OTP_TYPES.includes(typeParam as EmailOtpType)
      ? (typeParam as EmailOtpType)
      : "email";

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
      );
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
      );
    }
  } else {
    return NextResponse.redirect(new URL("/login?error=missing-code", request.url));
  }

  return NextResponse.redirect(new URL("/", request.url));
}
