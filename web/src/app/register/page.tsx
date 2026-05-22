import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { registerUser } from "./actions";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await searchParams;
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-large-title">BDI Захиалга</h1>
          <p className="text-body text-muted-foreground mt-2">
            {sent ? "Имэйлээ шалгана уу" : "Шинэ бүртгэл үүсгэх"}
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Mail className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold">Баталгаажуулах холбоос илгээлээ</p>
              <p className="text-caption text-muted-foreground">
                <span className="font-mono text-foreground">{sent}</span>
              </p>
              <p className="text-caption text-muted-foreground">
                Имэйлээ нээж холбоосон дээр дарж бүртгэлээ баталгаажуулна уу.
              </p>
              <p className="text-caption2 text-muted-foreground pt-2">
                Хэдэн минутын дотор имэйл ирэхгүй бол спам хавтсаа шалгана уу.
              </p>
            </div>
            <Link
              href="/login"
              className="text-caption2 text-primary inline-block hover:underline"
            >
              ← Нэвтрэх хуудас руу
            </Link>
          </div>
        ) : (
          <form action={registerUser} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="input-label">
                Овог нэр
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoFocus
                autoComplete="name"
                placeholder="Нэр"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="email" className="input-label">
                Имэйл
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                className="input-field"
              />
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
                minLength={8}
                autoComplete="new-password"
                placeholder="Доод тал нь 8 тэмдэгт"
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
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
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
              Бүртгүүлэх
            </button>
          </form>
        )}

        {!sent && (
          <div className="mt-6 space-y-3 text-center">
            <Link
              href="/register/phone"
              className="text-caption2 text-primary inline-flex items-center gap-1.5 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              Утсаар бүртгүүлэх
            </Link>
            <p className="text-caption text-muted-foreground">
              Аль хэдийн бүртгэлтэй бол{" "}
              <Link
                href="/login"
                className="text-primary font-semibold hover:underline"
              >
                нэвтрэх
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
