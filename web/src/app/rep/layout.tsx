import { redirect } from "next/navigation";
import { requireSession, homePathForRole } from "@/lib/auth";

export default async function RepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (session.profile.role !== "rep") {
    redirect(homePathForRole(session.profile));
  }
  return <div className="min-h-screen bg-muted/30">{children}</div>;
}
