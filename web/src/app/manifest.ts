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
 *                  icon.tsx art keeps the "BDI" mark inside the safe
 *                  zone so the clipping never cuts it off.
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
    // No orientation lock: admins use the installed app on tablets and
    // desktops in landscape (dispatch board, order tables).
    // Brand blue (BRAND.blue in lib/brand.ts): the splash screen and the
    // icon's edges are the same colour, and the status bar matches the
    // app's blue top bar.
    background_color: "#1c49ba",
    theme_color: "#1c49ba",
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
