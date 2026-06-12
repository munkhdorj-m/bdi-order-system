"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  CheckCircle2,
  Download,
  MoreVertical,
  Plus,
  Share,
  Smartphone,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMounted } from "@/lib/use-mounted";

/**
 * Install-app tutorial shown on the login screen.
 *
 * The site IS a PWA (see app/manifest.ts) but most buyers won't know
 * what "Add to Home Screen" means or where to find it. We surface a
 * tiny pill button under the login form — tapping it opens a Sheet
 * with platform-specific, visual step-by-step instructions.
 *
 * Detection:
 *   - Already installed (`display-mode: standalone` or iOS standalone)
 *     → we DON'T render anything. No point telling someone how to
 *     install what they've already installed.
 *   - iOS Safari → manual instructions (iOS has never exposed a
 *     programmatic install prompt — share button is the only way).
 *   - Android / Desktop Chromium → if the browser fired
 *     `beforeinstallprompt`, we cache it and show a single "Install"
 *     button that calls `prompt()` directly. If not (Firefox, older
 *     Chrome), we fall back to a menu-based instruction.
 *   - Other browsers → generic guidance.
 *
 * The pill is intentionally low-key — it sits below the register link
 * so it doesn't compete with the primary login CTA, but is visible
 * enough that a curious user can find it.
 */

type Platform = "ios" | "android" | "other";

// Chrome's beforeinstallprompt isn't on the standard Event yet. We
// type the subset we use so TS is happy without `any`.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac — sniff for touch + Mac as a fallback
  const isIpadOS =
    ua.includes("Macintosh") &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || isIpadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isAlreadyInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // Android / desktop Chromium: standalone display mode.
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari: legacy non-standard property.
  if (
    "standalone" in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  ) {
    return true;
  }
  return false;
}

export function InstallAppHint() {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  // Flipped by the `appinstalled` event or an accepted native prompt.
  // The initial "was it already installed before this page load" check
  // is a cheap pure read (matchMedia) we do during render below.
  const [installedThisSession, setInstalledThisSession] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Cache Chrome's "this site can be installed" event so we can fire
    // the prompt later from a click handler (Chrome only allows it from
    // a user gesture — we save it on capture, call prompt() on click).
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setInstalledThisSession(true);
      setDeferredPrompt(null);
      setOpen(false);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  // Pure browser reads, computed during render once mounted. Keeping
  // them out of state avoids the setState-in-effect cascade; the values
  // can't change without a reload anyway (platform) or are covered by
  // the appinstalled listener (installed).
  const platform: Platform = mounted ? detectPlatform() : "other";
  const installed = installedThisSession || (mounted && isAlreadyInstalled());

  // Don't render anything until we've checked the install state on the
  // client. Otherwise the SSR render would show the pill to users who
  // already have the app installed, which flashes ugly until hydration.
  if (!mounted || installed) return null;

  async function fireNativePrompt() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalledThisSession(true);
      setOpen(false);
    }
    // Either way the prompt is single-use — drop the reference.
    setDeferredPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 mx-auto flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Smartphone className="h-3.5 w-3.5" />
        <span>Утсандаа аппликейшн болгож суулгах</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="sm:max-w-md sm:mx-auto sm:rounded-t-2xl"
        >
          <SheetHeader className="px-5 pt-5 pb-2">
            <SheetTitle className="flex items-center gap-2 text-[17px]">
              <Smartphone className="h-5 w-5 text-primary" />
              BDI-г аппликейшн болгож суулгах
            </SheetTitle>
            <SheetDescription className="text-[12.5px]">
              Хөтөч нээх шаардлагагүй, утсан дээрээ нэг товшилтоор нэвтэрнэ.
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-6 pt-2 overflow-y-auto max-h-[70vh]">
            {platform === "ios" && <IosSteps />}
            {platform === "android" && (
              <AndroidSteps
                canPrompt={!!deferredPrompt}
                onPrompt={fireNativePrompt}
              />
            )}
            {platform === "other" && <OtherSteps />}

            <p className="mt-5 text-[11.5px] text-muted-foreground leading-relaxed">
              Суулгасны дараа дэлгэцэн дээрх <strong>BDI</strong> дүрс дээр дарж
              дотроос нь шууд нэвтэрнэ.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ---------- Platform-specific step lists ----------

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="shrink-0 size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[13px] font-bold ring-1 ring-primary/20">
        {n}
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
          {icon}
          <span>{title}</span>
        </div>
        {body && (
          <div className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
            {body}
          </div>
        )}
      </div>
    </li>
  );
}

function IosSteps() {
  return (
    <>
      <div className="rounded-xl bg-muted/50 px-3 py-2 mb-4 text-[11.5px] text-muted-foreground">
        iPhone / iPad дээр <strong>Safari</strong> хөтөч ашиглана уу. Бусад
        хөтөчүүд (Chrome, Firefox) дэмждэггүй.
      </div>

      <ol className="space-y-4">
        <Step
          n={1}
          icon={<Share className="h-4 w-4 text-primary" />}
          title={
            <>
              Доод талын <span className="text-primary">Хуваалцах</span> товчийг
              дарна
            </>
          }
          body="Дөрвөлжин дотроос дээш чиглэсэн сум хэлбэртэй товч. Safari-н ёроолд байрладаг."
        />
        <Step
          n={2}
          icon={<ArrowDown className="h-4 w-4 text-primary" />}
          title="Жагсаалтыг доош гүйлгэнэ"
          body='"Add to Home Screen" буюу "Дэлгэцэнд нэмэх" сонголтыг олно.'
        />
        <Step
          n={3}
          icon={<Plus className="h-4 w-4 text-primary" />}
          title='"Add to Home Screen" дээр дарна'
          body="BDI лого болон нэр гарч ирнэ. Хэрэгтэй бол нэрийг засаж болно."
        />
        <Step
          n={4}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          title='Баруун дээд буланд "Add" / "Нэмэх" дарна'
          body="Дэлгэцэн дээр BDI дүрс гарч ирнэ. Тэрхүү дүрсээр дарж аппыг нээнэ."
        />
      </ol>
    </>
  );
}

function AndroidSteps({
  canPrompt,
  onPrompt,
}: {
  canPrompt: boolean;
  onPrompt: () => void;
}) {
  // Best path: Chrome already offered the install. Fire its native
  // prompt directly — single tap, no manual menu walk.
  if (canPrompt) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40 px-4 py-3 text-[12.5px] text-emerald-800 dark:text-emerald-200 leading-relaxed">
          Таны хөтөч энэ аппыг шууд суулгахад бэлэн байна. Доорх товчийг дарна
          уу.
        </div>
        <button
          type="button"
          onClick={onPrompt}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        >
          <Download className="h-4 w-4" />
          Аппликейшн суулгах
        </button>
        <p className="text-[11.5px] text-muted-foreground text-center">
          Эсвэл доорх гарын авлагаар гараар нэмэх боломжтой.
        </p>
        <details className="text-[12.5px]">
          <summary className="cursor-pointer text-primary font-semibold">
            Гараар суулгах заавар
          </summary>
          <div className="mt-3">
            <AndroidManualSteps />
          </div>
        </details>
      </div>
    );
  }

  // Fallback: no programmatic prompt — most likely Firefox or older
  // Chrome. Show the menu-based steps.
  return (
    <>
      <div className="rounded-xl bg-muted/50 px-3 py-2 mb-4 text-[11.5px] text-muted-foreground">
        Android дээр <strong>Chrome</strong> хөтөч ашиглавал хамгийн хялбар.
      </div>
      <AndroidManualSteps />
    </>
  );
}

function AndroidManualSteps() {
  return (
    <ol className="space-y-4">
      <Step
        n={1}
        icon={<MoreVertical className="h-4 w-4 text-primary" />}
        title="Баруун дээд буланд гурван цэг товчийг дарна"
        body="Chrome хөтөчийн цэс нээгдэнэ."
      />
      <Step
        n={2}
        icon={<Download className="h-4 w-4 text-primary" />}
        title={
          <>
            <span>&quot;Install app&quot;</span>{" "}
            <span className="text-muted-foreground font-normal">эсвэл</span>{" "}
            <span>&quot;Add to Home screen&quot;</span> сонгоно
          </>
        }
        body="Хөтчийн хувилбараас хамаарч аль нэг нь гарч ирнэ."
      />
      <Step
        n={3}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        title='"Install" / "Суулгах" дарна'
        body="Дэлгэцэн дээр BDI дүрс гарч ирнэ. Аппыг дотроос нь нээнэ."
      />
    </ol>
  );
}

function OtherSteps() {
  return (
    <>
      <ol className="space-y-4">
        <Step
          n={1}
          icon={<Smartphone className="h-4 w-4 text-primary" />}
          title="Утсаараа энэ хуудсыг нээнэ үү"
          body="iPhone дээр Safari, Android дээр Chrome ашиглавал шууд аппликейшн болгож суулгах товч гарч ирнэ."
        />
        <Step
          n={2}
          icon={<Download className="h-4 w-4 text-primary" />}
          title="Хөтөчийн цэснээс суулгах сонголтыг олно"
          body='Desktop Chrome дээр URL мөрний баруун талд жижиг дүрс гарч ирэх ба түүн дээр дарж "Install" гэснийг сонгоно.'
        />
      </ol>
    </>
  );
}
