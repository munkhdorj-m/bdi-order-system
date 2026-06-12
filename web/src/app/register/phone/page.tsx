import Link from "next/link";
import { startVerification } from "./actions";

type SearchParams = Promise<{ error?: string; phone?: string; name?: string }>;

/**
 * Phone registration — same bold full-bleed gradient + floating card
 * language as /login so the auth flow reads as one continuous space.
 */
export default async function RegisterByPhonePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, phone, name } = await searchParams;

  return (
    <main className="relative flex-1 min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 py-10 text-white bg-brand-gradient">
      <div
        className="absolute -top-32 -right-24 size-96 rounded-full bg-white/15 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-28 size-96 rounded-full bg-white/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative w-full max-w-sm page-enter">
        <div className="text-center mb-7">
          <div className="size-16 mx-auto rounded-[1.4rem] bg-white/15 backdrop-blur-md ring-1 ring-white/30 shadow-lg shadow-black/10 flex items-center justify-center font-extrabold text-xl tracking-tight">
            BDI
          </div>
          <h1 className="mt-5 text-[28px] font-extrabold tracking-tight leading-tight">
            Бүртгүүлэх
          </h1>
          <p className="mt-1.5 text-[14px] text-white/80">
            Утасны дугаараараа нэг минутад бүртгүүлээрэй
          </p>
        </div>

        <div className="rounded-[1.75rem] bg-card text-card-foreground shadow-2xl shadow-black/25 ring-1 ring-black/5 dark:ring-white/10 p-6">
          <form action={startVerification} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="input-label">
                Овог нэр
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                placeholder="Нэр"
                defaultValue={name ?? ""}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="phone" className="input-label">
                Утасны дугаар
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="numeric"
                placeholder="99112233"
                defaultValue={phone ?? ""}
                className="input-field"
              />
              <p className="text-caption2 text-muted-foreground mt-1.5">
                8 оронтой Монгол утас. Жишээ нь 99112233.
              </p>
            </div>
            <div>
              <label htmlFor="password" className="input-label">
                Нууц үг
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                placeholder="Хамгийн багадаа 8 тэмдэгт"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="input-label">
                Нууц үг давтах
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                placeholder="Дахин оруулах"
                className="input-field"
              />
            </div>

            {error && (
              <p
                className="text-caption rounded-xl px-3 py-2 bg-destructive/10 text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full h-12 text-[15px]"
            >
              Үргэлжлүүлэх
            </button>
          </form>
        </div>

        <p className="mt-6 text-[13px] text-white/80 text-center">
          Аль хэдийн бүртгэлтэй бол{" "}
          <Link
            href="/login"
            className="text-white font-bold underline underline-offset-4 decoration-white/50 hover:decoration-white"
          >
            нэвтрэх
          </Link>
        </p>
      </div>
    </main>
  );
}
