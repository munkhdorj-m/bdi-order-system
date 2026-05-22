import type { MetadataRoute } from "next";

/**
 * PWA manifest — generates /manifest.webmanifest automatically.
 *
 * When a buyer opens the site on Android Chrome they'll get the proper
 * "Install BDI Захиалга" prompt; tapping it adds the app to the home
 * screen and the app runs in standalone mode (no browser URL bar).
 *
 * The two icon entries cover both purposes Android needs:
 *   - "any"      → standard app drawer / shortcut icon
 *   - "maskable" → adaptive icons that get clipped to the OS shape
 *                  (circle on Pixel, squircle on Samsung, etc.) — the
 *                  icon.tsx art keeps the "B" inside a ~58% safe zone
 *                  so the clipping never cuts the letter off.
 *
 * theme_color matches the brand indigo so the Android system bar
 * tints when the app is open. background_color is the splash colour
 * shown for the half-second between tap and first paint.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BDI Захиалга",
    short_name: "BDI",
    description: "BDI B2B захиалгын систем — каталог, сагс, захиалга",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#4338ca",
    lang: "mn",
    dir: "ltr",
    categories: ["business", "shopping", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
