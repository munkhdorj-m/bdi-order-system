import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    // Allow higher qualities than the default of just [75].
    qualities: [75, 85, 90, 95],
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
