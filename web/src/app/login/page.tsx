import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, KeyRound, CheckCircle2 } from "lucide-react";
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
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="size-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 shadow-sm">
            <span className="text-lg font-bold tracking-tight">BDI</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Захиалгын систем
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isPasswordMode
              ? "Имэйл & нууц үгээр нэвтэрнэ үү"
              : "Имэйл хаягаараа нэвтэрнэ үү"}
          </p>
        </div>

        <div className="rounded-2xl border bg-background p-6 shadow-sm">
          {sent ? (
            <div className="text-center space-y-3 py-2">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">Холбоосыг илгээлээ</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-mono text-foreground">{sent}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Имэйлээ нээж нэвтрэх холбоосон дээр дарна уу.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-block text-xs text-muted-foreground hover:text-foreground"
              >
                ← Дахин илгээх
              </Link>
            </div>
          ) : isPasswordMode ? (
            <form action={signInWithPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1.5"
                >
                  Имэйл
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  className="w-full rounded-md border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-1.5"
                >
                  Нууц үг
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full rounded-md border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Нэвтрэх
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground hover:text-foreground pt-1"
              >
                <Mail className="h-3.5 w-3.5" />
                Имэйл холбоосоор нэвтрэх
              </Link>
            </form>
          ) : (
            <form action={sendMagicLink} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1.5"
                >
                  Имэйл
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="name@example.com"
                  className="w-full rounded-md border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Нэвтрэх холбоос илгээх
              </button>

              <Link
                href="/login?mode=password"
                className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground hover:text-foreground pt-1"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Нууц үгээр нэвтрэх
              </Link>
            </form>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Шинэ бол BDI-н ажилтантай холбогдоно уу.
        </p>
      </div>
    </main>
  );
}
