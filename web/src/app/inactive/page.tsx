import { redirect } from "next/navigation";
import { homePathForRole, requireSession } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { ContactLinks } from "@/components/contact-links";
import { hasContactLinks } from "@/lib/contact";

/** An account an admin switched off (a sign-up still waiting sees /pending). */
export default async function InactivePage() {
  const session = await requireSession();
  // Switched back on (or a pending sign-up): go to where this account belongs.
  const home = homePathForRole(session.profile);
  if (home !== "/inactive") redirect(home);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-aurora">
      <div className="max-w-md w-full text-center page-enter">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">
          Бүртгэл идэвхгүй
        </h1>
        <p className="text-muted-foreground mb-2">
          <span className="font-mono text-sm">
            {session.profile.phone ?? session.profile.full_name ?? "—"}
          </span>
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Таны бүртгэл идэвхгүй болсон байна. Дахин нээлгэхээр доорхоор
          холбогдоно уу.
        </p>

        {hasContactLinks() && (
          <div className="mb-8 text-left">
            <ContactLinks variant="card" />
          </div>
        )}

        <SignOutButton />
      </div>
    </main>
  );
}
