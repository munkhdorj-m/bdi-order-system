import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { OtpCells } from "@/components/buyer/otp-cells";
import { verifyOtp } from "../actions";

type SearchParams = Promise<{
  phone?: string;
  error?: string;
}>;

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { phone, error } = await searchParams;

  // Nothing to verify against — bounce back to the phone-entry step.
  // The server action also re-checks that the pending cookie exists
  // for this phone, so the URL alone can't replay a registration.
  if (!phone) redirect("/register/phone");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h1 className="text-large-title">Кодыг оруулна уу</h1>
          <p className="text-body text-muted-foreground mt-2">
            Бид <span className="font-mono text-foreground">{phone}</span> руу
            6 оронтой код илгээлээ.
          </p>
        </div>

        <form action={verifyOtp} className="space-y-4">
          <input type="hidden" name="phone" value={phone} />

          {/* 6 individual cells with auto-advance, backspace-to-previous, and
              paste-from-SMS handling. The combined value lands in a hidden
              <input name="code"> so the existing verifyOtp server action
              still reads formData.get("code"). Name + password live in
              the httpOnly pending cookie set by sendOtp. */}
          <OtpCells name="code" length={6} />

          {error && (
            <p
              className="text-caption rounded-lg px-3 py-2 bg-destructive/10 text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full">
            Баталгаажуулах
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center">
          <Link
            href={`/register/phone?phone=${encodeURIComponent(phone)}`}
            className="text-caption2 text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Дугаар засах / Дахин код авах
          </Link>
        </div>
      </div>
    </main>
  );
}
