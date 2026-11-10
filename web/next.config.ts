import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

/**
 * Sent with every response. The app never frames itself, uses no camera,
 * microphone or location, and nothing needs the full URL in Referer.
 * HSTS is left to Vercel, which adds it on its HTTPS domains (sending it
 * from here would also pin a local HTTPS dev host).
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js" advert.
  poweredByHeader: false,
  images: {
    // Allow higher qualities than the default of just [75].
    qualities: [75, 85, 95],
    // Product thumbnails top out near 200 CSS px (x3 on dense phones) and
    // nothing in the app shows an optimised photo wider than ~1200px. The
    // defaults (16 widths up to 3840) put a 10-16 entry srcset on every
    // product card; these 8 widths halve that markup.
    deviceSizes: [640, 828, 1200],
    imageSizes: [64, 96, 128, 256, 384],
    // Skip AVIF: it's smaller but produces blocky artifacts on product
    // packaging photos with text/labels. WebP is friendlier to those.
    formats: ["image/webp"],
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : undefined,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    // Keep pages the user just saw in the browser's router cache, so going
    // back (catalog ↔ product, orders ↔ order) is instant instead of another
    // trip to the server. Anything a server action changes is refreshed
    // regardless (revalidatePath clears this cache).
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // Listed after the catch-all so its stricter CSP wins for this file.
        // The push service worker must never be cached. Browsers hold a
        // service worker until the byte-for-byte response changes, so a
        // CDN-cached /sw.js would pin every admin's device to whatever
        // version shipped first and silently ignore later fixes.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
