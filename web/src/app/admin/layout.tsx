import { redirect } from "next/navigation";
import { requireSession, homePathForRole } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (session.profile.role !== "admin") {
    redirect(homePathForRole(session.profile));
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminHeader
          email={session.email}
          name={session.profile.full_name}
        />
        <main className="flex-1 p-6 lg:p-8 bg-muted/30">{children}</main>
      </div>
    </div>
  );
}
