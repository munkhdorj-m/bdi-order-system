import Link from "next/link";
import { startVerification } from "./actions";

type SearchParams = Promise<{ error?: string; phone?: string; name?: string }>;

export default async function RegisterByPhonePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, phone, name } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-large-title">BDI Захиалга</h1>
          <p className="text-body text-muted-foreground mt-2">
            Утсаар бүртгүүлэх
          </p>
        </div>

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
              className="text-caption rounded-lg px-3 py-2 bg-destructive/10 text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full">
            Үргэлжлүүлэх
          </button>
        </form>

        <p className="mt-6 text-caption text-muted-foreground text-center">
          Аль хэдийн бүртгэлтэй бол{" "}
          <Link
            href="/login"
            className="text-primary font-semibold hover:underline"
          >
            нэвтрэх
          </Link>
        </p>
      </div>
    </main>
  );
}
