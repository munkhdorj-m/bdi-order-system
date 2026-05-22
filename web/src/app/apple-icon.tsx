import { ImageResponse } from "next/og";

// Apple's recommended iOS home-screen icon size. iOS applies a rounded
// "superellipse" mask itself, so we don't need to bake in corner rounding.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS / Safari home-screen icon. Same brand mark as the Android icon
 * but tuned for Apple's rendering pipeline:
 *
 *   - No corner rounding (iOS applies the superellipse mask itself).
 *   - No safe-zone padding required — iOS doesn't clip aggressively
 *     like Android adaptive icons, so the letter can fill more of the
 *     canvas (~75% of height) and read crisper at small sizes.
 *   - Solid gradient instead of a transparent corner — iOS rejects
 *     icons with transparency on the home screen, replacing them with
 *     a black background.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #4f46e5 0%, #4338ca 55%, #3730a3 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 140,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.04em",
          boxShadow: "inset 0 -8px 32px rgba(0,0,0,0.22)",
        }}
      >
        B
      </div>
    ),
    { ...size },
  );
}
