import { ImageResponse } from "next/og";
import { BDI_ASPECT, BDI_PATH, BDI_VIEWBOX, BRAND } from "@/lib/brand";

// Apple's recommended iOS home-screen icon size. iOS rounds the corners
// itself, so the art is a full square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon — same art as icon.tsx. iOS doesn't crop to odd
 * shapes like Android, so the mark can be larger (~66% of the width) and
 * reads crisper at small sizes. Solid background: iOS turns transparent
 * pixels black.
 */
export default function AppleIcon() {
  const w = 118;
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
          backgroundImage:
            "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0) 62%)",
        }}
      >
        <svg width={w} height={Math.round(w / BDI_ASPECT)} viewBox={BDI_VIEWBOX}>
          <path d={BDI_PATH} fill="#ffffff" />
        </svg>
        <div style={{ marginTop: 11, width: w, height: 6, borderRadius: 3, backgroundColor: BRAND.gold }} />
      </div>
    ),
    { ...size },
  );
}
