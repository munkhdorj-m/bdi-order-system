import { requireSession } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function PendingPage() {
  const session = await requireSession();

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-aurora">
      <div className="max-w-md text-center page-enter">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">
          Бүртгэл хүлээгдэж байна
        </h1>
        <p className="text-muted-foreground mb-2">
          <span className="font-mono text-sm">
            {session.profile.phone ?? session.profile.full_name ?? "—"}
          </span>
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Таны бүртгэлийг BDI-н ажилтан дэлгүүрт хуваарилах хүртэл хүлээнэ үү.
          Асуудал гарвал BDI-н ажилтантай холбогдоно уу.
        </p>
        <SignOutButton />
      </div>
    </main>
  );
}
