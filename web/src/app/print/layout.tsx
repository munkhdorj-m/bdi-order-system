import { redirect } from "next/navigation";
import { hasActiveRole, homePathForRole, requireSession } from "@/lib/auth";

/**
 * Printable documents (delivery notes, loading list). No app chrome; always
 * black on white whatever the app theme. Admins only.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!hasActiveRole(session.profile, "admin")) redirect(homePathForRole(session.profile));

  return (
    <div className="min-h-screen bg-neutral-100 text-black print:bg-white [color-scheme:light]">
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}
