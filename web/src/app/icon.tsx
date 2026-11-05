import { ImageResponse } from "next/og";
import { BDI_ASPECT, BDI_PATH, BDI_VIEWBOX, BRAND } from "@/lib/brand";

// 512×512 is the largest size Android adaptive icons read. Smaller
// sizes get downscaled from this single source.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * App icon (phone home screen, app switcher, splash, notifications):
 * the white "BDI" wordmark with a gold line under it, on brand blue —
 * the same tile the app shows next to its name (components/brand).
 *
 * Safe zone: Android crops "maskable" icons to the launcher's shape
 * (circle, squircle, teardrop), all of which keep a centred circle 80% of
 * the canvas wide. The mark is 300px wide and ~165px tall, so its corners
 * sit ~170px from the centre — inside that 205px circle on every shape.
 *
 * Edges are flat brand blue, exactly the manifest's background_color, so
 * the splash screen and icon meet without a visible square.
 */
export default function Icon() {
  const w = 300;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BRAND.blue,
          // Soft light behind the letters; fully clear before the edges.
          backgroundImage:
            "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0) 58%)",
        }}
      >
        <svg width={w} height={Math.round(w / BDI_ASPECT)} viewBox={BDI_VIEWBOX}>
          <path d={BDI_PATH} fill="#ffffff" />
        </svg>
        <div style={{ marginTop: 30, width: w, height: 16, borderRadius: 8, backgroundColor: BRAND.gold }} />
      </div>
    ),
    { ...size },
  );
}
