import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

// Type pairing for the "Тэнгэр ба алт" look:
//   Onest     — text and UI. Drawn for Cyrillic first, very readable at small
//               sizes on phones.
//   Unbounded — display: page titles, section titles, prices. Wide and
//               geometric; it is what makes the app recognisable at a glance.
// Both need "cyrillic-ext": Mongolian Ө/ө and Ү/ү live there, not in the
// plain "cyrillic" subset (without it those letters fall back to another
// font mid-word).
const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
});
const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BDI Захиалга",
  description: "BDI B2B ordering system",
  // Apple-specific PWA hints. The manifest.ts at app/ already provides
  // the cross-browser PWA metadata; these add iOS extras (status-bar
  // style, "Apps that work with Apple Safari" treatment) so an
  // installed iOS home-screen icon launches in proper standalone mode.
  appleWebApp: {
    capable: true,
    title: "BDI",
    statusBarStyle: "default",
  },
  applicationName: "BDI Захиалга",
  formatDetection: {
    telephone: false,
  },
};

/**
 * Viewport + theme-color metadata. Splitting these out is required in
 * Next 16 — putting `themeColor` / `viewport` on the Metadata object
 * is deprecated. The two-entry array gives the Android Chrome system
 * bar an indigo tint in light mode and a near-black tint in dark mode.
 *
 * `viewportFit: "cover"` is the PWA install dance: when the app runs
 * standalone on a notched iPhone, this lets us paint into the safe
 * area and use env(safe-area-inset-*) on sticky bars / tab bars.
 */
export const viewport: Viewport = {
  // Keep in sync with --primary / --background in globals.css.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f4fcc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1630" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      // next-themes mutates <html class> before hydration; this stops React
      // from warning about the mismatch between server (no .dark) and client.
      suppressHydrationWarning
      // Tells Next router transitions to ignore the global `scroll-behavior: smooth`
      // rule so route jumps don't smooth-scroll (which feels janky on Next).
      data-scroll-behavior="smooth"
      className={`${onest.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={["light", "dark"]}
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" richColors closeButton />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
