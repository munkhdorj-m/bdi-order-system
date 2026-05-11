import { redirect } from "next/navigation";
import { requireSession, homePathForRole } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function RepHome() {
  const session = await requireSession();
  if (session.profile.role !== "rep") {
    redirect(homePathForRole(session.profile));
  }

  return (
    <main className="flex-1 px-6 py-12 max-w-2xl mx-auto w-full">
      <header className="flex justify-between items-start mb-10">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Төлөөлөгч</p>
          <h1 className="text-3xl font-semibold tracking-tight">Миний дэлгүүрүүд</h1>
        </div>
        <SignOutButton />
      </header>

      <p className="text-zinc-500 mb-6">
        Сайн уу, <span className="font-medium text-zinc-900 dark:text-zinc-100">{session.email}</span>.
      </p>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <p className="text-sm text-zinc-500">
          Phase 5: дэлгүүрүүдийн өмнөөс захиалга үүсгэх хэсэг энд хийгдэнэ.
        </p>
      </div>
    </main>
  );
}
