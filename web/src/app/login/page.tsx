import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePathForRole } from "@/lib/auth";
import { signIn } from "./actions";

type SearchParams = Promise<{
  error?: string;
  success?: string;
  phone?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (session) redirect(homePathForRole(session.profile));
  const { error, success, phone } = await searchParams;

  return (
    <main className="flex-1 flex flex-col lg:flex-row min-h-screen">
      {/* Brand panel — full-width hero on mobile, 2/5 column on lg+.
          Background layering (top → bottom):
            1. Brand-gradient fallback (always present, no asset needed)
            2. Optional /login-hero.jpg overlay — drop a hero image into
               web/public/login-hero.jpg and it shows here. Missing file
               just 404s silently and the gradient remains.
            3. Dark overlay on top of the image so the white headline
               text stays legible regardless of the photo's brightness. */}
      <div
        className="relative lg:w-2/5 lg:min-h-screen flex flex-col justify-between px-6 pt-12 pb-10 lg:px-12 lg:pt-16 lg:pb-12 text-white overflow-hidden"
        style={{
          background:
            "linear-gradient(155deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 78%, black) 100%)",
        }}
      >
        {/* Optional photo layer — opacity ~0.55 so the gradient bleeds
            through and the brand colour still dominates. If you don't
            have an image yet, drop one at web/public/login-hero.jpg
            (any aspect; we use bg-cover bg-center). */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55 mix-blend-overlay"
          style={{ backgroundImage: "url('/login-hero.jpg')" }}
          aria-hidden
        />
        {/* Soft vignette so headline reads on bright photos */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30 pointer-events-none"
          aria-hidden
        />

        <div className="relative">
          <div className="size-12 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/25 flex items-center justify-center font-bold text-base">
            BDI
          </div>
          <h1 className="mt-8 lg:mt-12 text-[26px] lg:text-[34px] font-bold tracking-tight leading-tight">
            Захиалга өгөх<br />
            хамгийн хялбар арга
          </h1>
          <p className="mt-3 text-[14px] lg:text-[14.5px] opacity-85 max-w-[320px] leading-relaxed">
            BDI-н бөөний бараагаа дэлгүүрээсээ шууд захиалаарай.
          </p>
        </div>

        {/* Curved bottom transition on mobile — visual handoff into the form. */}
        <div className="lg:hidden absolute left-0 right-0 -bottom-px h-5 bg-background rounded-t-3xl" />
      </div>

      {/* Form panel — phone-only login. Email was removed app-wide; the
          buyer is a store manager on their phone and admin accounts are
          provisioned via /admin/users/new. */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 pt-8 pb-12 lg:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:mb-8">
            <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-primary">
              Нэвтрэх
            </div>
            <h2 className="mt-1 text-[24px] lg:text-[26px] font-bold tracking-tight">
              Тавтай морил
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              Утсаар нэвтэрнэ үү
            </p>
          </div>

          <form action={signIn} className="space-y-4">
            <div>
              <label htmlFor="phone" className="input-label">
                Утасны дугаар
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoFocus
                autoComplete="tel"
                inputMode="numeric"
                placeholder="99112233"
                defaultValue={phone ?? ""}
                className="input-field"
              />
              <p className="text-caption2 text-muted-foreground mt-1.5">
                8 оронтой Монгол утас.
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
                autoComplete="current-password"
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            {success && (
              <p className="text-caption rounded-lg px-3 py-2 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                {success === "phone-verified"
                  ? "Утас баталгаажлаа. BDI-н ажилтан таны бүртгэлийг идэвхжүүлмэгц нэвтэрч орох боломжтой."
                  : success}
              </p>
            )}
            {error && (
              <p
                className="text-caption rounded-lg px-3 py-2 bg-destructive/10 text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full">
              Нэвтрэх
            </button>
          </form>

          <p className="mt-6 text-caption text-muted-foreground text-center">
            Шинэ хэрэглэгч үү?{" "}
            <Link
              href="/register/phone"
              className="text-primary font-semibold hover:underline"
            >
              Бүртгүүлэх
            </Link>
          </p>

          <div className="hidden lg:block mt-12 text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} BDI · Захиалгын систем
          </div>
        </div>
      </div>
    </main>
  );
}
