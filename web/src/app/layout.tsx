import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4338ca" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1b4b" },
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
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
