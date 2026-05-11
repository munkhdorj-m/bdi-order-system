import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePathForRole } from "@/lib/auth";
import { sendMagicLink, signInWithPassword } from "./actions";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  mode?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (session) redirect(homePathForRole(session.profile));

  const { error, sent, mode } = await searchParams;
  const isPasswordMode = mode === "password";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">BDI Захиалга</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isPasswordMode ? "Имэйл & нууц үгээр нэвтрэх" : "Имэйл хаягаараа нэвтрэх"}
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-4 text-sm text-emerald-800 dark:text-emerald-300">
            <p className="font-medium mb-1">Холбоосыг илгээлээ ✉️</p>
            <p>
              <span className="font-mono">{sent}</span> хаягт нэвтрэх холбоос
              илгээгдсэн. Имэйлээ шалгана уу.
            </p>
          </div>
        ) : isPasswordMode ? (
          <form action={signInWithPassword} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Имэйл
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="name@example.com"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Нууц үг
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Нэвтрэх
            </button>

            <p className="text-center text-xs text-zinc-500 pt-2">
              <Link href="/login" className="hover:underline">
                ← Имэйл холбоосоор нэвтрэх
              </Link>
            </p>
          </form>
        ) : (
          <form action={sendMagicLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Имэйл
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="name@example.com"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Нэвтрэх холбоос илгээх
            </button>

            <p className="text-center text-xs text-zinc-500 pt-2">
              <Link href="/login?mode=password" className="hover:underline">
                Нууц үгээр нэвтрэх →
              </Link>
            </p>
          </form>
        )}

        <p className="mt-6 text-xs text-zinc-400 text-center">
          Шинэ бол BDI-н ажилтантай холбогдоно уу.
        </p>
      </div>
    </main>
  );
}
