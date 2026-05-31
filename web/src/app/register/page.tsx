import { redirect } from "next/navigation";

/**
 * The email-based register flow was removed in favor of phone-only
 * verification via verify.mn. Anyone hitting /register (old bookmark,
 * stale link) lands at /register/phone instead.
 */
export default function RegisterRedirect(): never {
  redirect("/register/phone");
}
