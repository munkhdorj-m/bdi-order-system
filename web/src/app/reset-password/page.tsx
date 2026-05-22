import { updatePassword } from "./actions";

type SearchParams = Promise<{ error?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-sm">
        <h1 className="text-large-title text-center mb-2">Шинэ нууц үг</h1>
        <p className="text-body text-muted-foreground text-center mb-10">
          Шинэ нууц үгээ тохируулна уу
        </p>

        <form action={updatePassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="input-label">
              Шинэ нууц үг
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
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
            Нууц үг шинэчлэх
          </button>
        </form>
      </div>
    </main>
  );
}
