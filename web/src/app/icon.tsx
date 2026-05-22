import { ImageResponse } from "next/og";

// 512×512 is the largest size Android adaptive icons read. Smaller
// browser-tab favicons get auto-downscaled from this single source.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * App icon. Single bold white "B" on an indigo gradient, generated
 * server-side via next/og.
 *
 * Sizing math: the letter glyph occupies ~58% of the canvas height so
 * the same image works as a maskable Android adaptive icon — every
 * launcher shape (Pixel circle, Samsung squircle, OPPO teardrop, etc.)
 * clips to a circle that fits inside an 80% inscribed square. Keeping
 * the letter inside ~58% leaves comfortable safe margin in all
 * orientations.
 *
 * Three "BDI"? A single "B" reads better at small sizes (favicon, tab
 * thumbnail) — three letters would blur into a mess at 32px. The full
 * "BDI Захиалга" wordmark lives in the OG image / login screen.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          // Brand indigo gradient — same hue family as --primary in
          // globals.css (oklch hue 263). Hex picked to match the
          // 0.5 0.18 263 OKLCH primary closely.
          background:
            "linear-gradient(135deg, #4f46e5 0%, #4338ca 55%, #3730a3 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 300,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.04em",
          // Subtle inner highlight to give the flat tile a tiny bit of
          // depth — reads as "polished icon" instead of "screenshot of
          // a div."
          boxShadow: "inset 0 -16px 64px rgba(0,0,0,0.25)",
        }}
      >
        B
      </div>
    ),
    { ...size },
  );
}
