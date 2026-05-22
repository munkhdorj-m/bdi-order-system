import Link from "next/link";
import { sendResetEmail } from "./actions";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await searchParams;
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-sm">
        <h1 className="text-large-title text-center mb-2">Нууц үг сэргээх</h1>
        <p className="text-body text-muted-foreground text-center mb-10">
          {sent ? "Имэйлээ шалгана уу" : "Сэргээх холбоосыг имэйлээр авах"}
        </p>

        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-caption text-muted-foreground">
              <span className="font-mono text-foreground">{sent}</span> хаяг руу
              илгээгдлээ
            </p>
            <p className="text-caption text-muted-foreground">
              Имэйлээ нээж холбоосон дээр дарна уу.
            </p>
            <Link
              href="/forgot-password"
              className="text-caption2 text-primary block mt-2 hover:underline"
            >
              Дахин илгээх
            </Link>
          </div>
        ) : (
          <form action={sendResetEmail} className="space-y-4">
            <div>
              <label htmlFor="email" className="input-label">
                Имэйл
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="name@example.com"
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
              Сэргээх холбоос илгээх
            </button>
          </form>
        )}

        <p className="mt-6 text-caption text-muted-foreground text-center">
          <Link href="/login" className="text-primary hover:underline">
            ← Нэвтрэх хуудас руу
          </Link>
        </p>
      </div>
    </main>
  );
}
