import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePathForRole } from "@/lib/auth";
import { Phone } from "lucide-react";
import { InstallAppHint } from "@/components/install-app-hint";
import { getContactLinks } from "@/lib/contact";
import { signIn } from "./actions";

type SearchParams = Promise<{
  error?: string;
  success?: string;
  phone?: string;
}>;

/**
 * Bold full-bleed login: the entire viewport is the brand gradient and
 * the form floats in a white card on top. One column on every screen
 * size — the buyer is a store manager on a phone, and desktop gets the
 * same hero treatment scaled up instead of a corporate split panel.
 *
 * Background layering (top → bottom):
 *   1. Brand gradient (always present, no asset needed)
 *   2. Optional /login-hero.jpg overlay — drop a photo into
 *      web/public/login-hero.jpg and it blends in. A missing file just
 *      404s silently and the gradient remains.
 *   3. Light blooms + vignette so the card and headline stay readable.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (session) redirect(homePathForRole(session.profile));
  const { error, success, phone } = await searchParams;

  // Only the phone goes on the login screen (centered, below). Full
  // contact + social list is on the in-app Холбоо барих tab.
  const phoneLink = getContactLinks().find((l) => l.type === "phone");

  return (
    <main className="relative flex-1 min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 py-10 text-white bg-brand-gradient">
      {/* Optional photo layer — kept subtle so the brand color dominates. */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
        style={{ backgroundImage: "url('/login-hero.jpg')" }}
        aria-hidden
      />
      {/* Light blooms — the gradient reads as lit, not flat. */}
      <div
        className="absolute -top-32 -right-24 size-96 rounded-full bg-white/15 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-28 size-96 rounded-full bg-white/10 blur-3xl pointer-events-none"
        aria-hidden
      />
      {/* Soft vignette for legibility over bright photos. */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25 pointer-events-none"
        aria-hidden
      />

      <div className="relative w-full max-w-sm page-enter">
        {/* Brand mark + headline above the card */}
        <div className="text-center mb-7">
          <div className="size-16 mx-auto rounded-[1.4rem] bg-white/15 backdrop-blur-md ring-1 ring-white/30 shadow-lg shadow-black/10 flex items-center justify-center font-extrabold text-xl tracking-tight">
            BDI
          </div>
          <h1 className="mt-5 text-[28px] font-extrabold tracking-tight leading-tight">
            Тавтай морил
          </h1>
          <p className="mt-1.5 text-[14px] text-white/80">
            Бөөний бараагаа дэлгүүрээсээ шууд захиалаарай
          </p>
        </div>

        {/* Floating form card */}
        <div className="rounded-[1.75rem] bg-card text-card-foreground shadow-2xl shadow-black/25 ring-1 ring-black/5 dark:ring-white/10 p-6">
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
              <p className="text-caption rounded-xl px-3 py-2 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                {success === "phone-verified"
                  ? "Утас баталгаажлаа. BDI-н ажилтан таны бүртгэлийг идэвхжүүлмэгц нэвтэрч орох боломжтой."
                  : success}
              </p>
            )}
            {error && (
              <p
                className="text-caption rounded-xl px-3 py-2 bg-destructive/10 text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full h-12 text-[15px]">
              Нэвтрэх
            </button>
          </form>
        </div>

        <p className="mt-6 text-[13px] text-white/80 text-center">
          Шинэ хэрэглэгч үү?{" "}
          <Link
            href="/register/phone"
            className="text-white font-bold underline underline-offset-4 decoration-white/50 hover:decoration-white"
          >
            Бүртгүүлэх
          </Link>
        </p>

        {/* Install tutorial trigger — recolored for the gradient via the
            wrapper (the component itself is theme-neutral). The Sheet it
            opens portals to <body>, so card styles inside are unaffected. */}
        <div className="flex justify-center [&>button]:text-white/70 [&>button:hover]:text-white">
          <InstallAppHint />
        </div>

        {/* Just the phone here — the full contact + social list lives on
            the in-app "Холбоо барих" tab. A locked-out user only needs a
            number to call. */}
        {phoneLink && (
          <a
            href={phoneLink.href}
            className="mt-6 mx-auto flex items-center justify-center gap-2 text-white/90 hover:text-white transition-colors"
          >
            <Phone className="h-4 w-4" strokeWidth={2} />
            <span className="text-[14px] font-semibold tabular-nums">
              {phoneLink.display}
            </span>
          </a>
        )}

        <div className="mt-6 text-center text-[11px] text-white/55">
          © {new Date().getFullYear()} BDI · Захиалгын систем
        </div>
      </div>
    </main>
  );
}
