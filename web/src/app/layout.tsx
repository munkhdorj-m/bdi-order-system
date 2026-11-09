import type { Metadata, Viewport } from "next";
import { Montserrat, Onest } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Type pairing for the "Тэнгэр ба алт" look:
//   Onest      — text and UI. Drawn for Cyrillic first, very readable at
//                small sizes on phones.
//   Montserrat — display: page titles, section titles, prices. Wide and
//                geometric, and it has real Mongolian Ө/ө and Ү/ү glyphs.
//                (Unbounded, tried first, lacks them — the browser borrowed
//                those two letters from another font.)
// Both need "cyrillic-ext": Ө/ө and Ү/ү live there, not in the plain
// "cyrillic" subset.
const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
});
const montserrat = Montserrat({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
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
 * is deprecated. The two-entry array tints the Android system bar brand
 * blue (matching the store/rep top bar) in light mode, navy in dark mode.
 *
 * `viewportFit: "cover"` is the PWA install dance: when the app runs
 * standalone on a notched iPhone, this lets us paint into the safe
 * area and use env(safe-area-inset-*) on sticky bars / tab bars.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.blue },
    { media: "(prefers-color-scheme: dark)", color: BRAND.navy },
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
      className={`${onest.variable} ${montserrat.variable} h-full antialiased`}
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
