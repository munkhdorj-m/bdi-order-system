/* eslint-disable react/prop-types */
/**
 * Shared sketchy wireframe primitives.
 *
 * Visual language:
 *  - Warm paper background, ink-black strokes
 *  - Kalam (handwriting) for labels, Patrick Hand (tighter) for body
 *  - One accent: BDI indigo (#3a3fbb) — only for primary actions / emphasis
 *  - One callout: coral (#d94e3a) — for annotations & "new!" badges
 *  - Borders are 1.5–2px solid ink; cards get a tiny x/y shadow to feel hand-drawn
 */

const ink = "#1a1a1a";
const paper = "#faf6ec";
const indigo = "#3a3fbb";
const coral = "#d94e3a";
const muted = "#8a857a";

/* ---------- Frames ---------- */

function Phone({ children, label, w = 300, h = 600, scale = 1 }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 32,
          border: `2.5px solid ${ink}`,
          background: paper,
          boxShadow: `2px 3px 0 ${ink}`,
          padding: 10,
          position: "relative",
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 14,
            borderRadius: 8,
            background: ink,
            zIndex: 5,
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            border: `1.5px solid ${ink}`,
            borderRadius: 24,
            overflow: "hidden",
            background: paper,
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
      {label && <Caption>{label}</Caption>}
    </div>
  );
}

function Desktop({ children, label, w = 760, h = 520 }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 10,
          border: `2.5px solid ${ink}`,
          background: paper,
          boxShadow: `3px 4px 0 ${ink}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* window chrome */}
        <div
          style={{
            height: 22,
            borderBottom: `1.5px solid ${ink}`,
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingLeft: 8,
            background: "#efeadd",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 4, border: `1px solid ${ink}` }} />
          <span style={{ width: 8, height: 8, borderRadius: 4, border: `1px solid ${ink}` }} />
          <span style={{ width: 8, height: 8, borderRadius: 4, border: `1px solid ${ink}` }} />
        </div>
        <div style={{ position: "relative", width: "100%", height: "calc(100% - 22px)" }}>
          {children}
        </div>
      </div>
      {label && <Caption>{label}</Caption>}
    </div>
  );
}

/* ---------- Type ---------- */

function Caption({ children, color = muted, size = 14 }) {
  return (
    <div
      style={{
        fontFamily: "'Kalam', cursive",
        fontSize: size,
        color,
        textAlign: "center",
        maxWidth: 360,
        lineHeight: 1.25,
      }}
    >
      {children}
    </div>
  );
}

function Annot({ children, color = coral, size = 14, style = {} }) {
  return (
    <span
      style={{
        fontFamily: "'Kalam', cursive",
        fontWeight: 700,
        fontSize: size,
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Label({ children, size = 13, weight = 400, color = ink, style = {} }) {
  return (
    <span
      style={{
        fontFamily: "'Patrick Hand', cursive",
        fontSize: size,
        fontWeight: weight,
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function H({ children, size = 18, color = ink, style = {} }) {
  return (
    <div
      style={{
        fontFamily: "'Kalam', cursive",
        fontWeight: 700,
        fontSize: size,
        color,
        lineHeight: 1.1,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Sketchy boxes ---------- */

function Box({
  children,
  w,
  h,
  fill = "transparent",
  stroke = ink,
  radius = 6,
  dashed = false,
  shadow = false,
  style = {},
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: fill,
        border: `1.5px ${dashed ? "dashed" : "solid"} ${stroke}`,
        borderRadius: radius,
        boxShadow: shadow ? `1.5px 2px 0 ${ink}` : "none",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ children, w = "100%", h = 36, primary = false, ghost = false, style = {} }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: primary ? indigo : ghost ? "transparent" : paper,
        color: primary ? "#fff" : ink,
        border: ghost ? "none" : `1.5px solid ${ink}`,
        borderRadius: 8,
        fontFamily: "'Kalam', cursive",
        fontWeight: 700,
        fontSize: 14,
        boxShadow: primary ? `1.5px 2px 0 ${ink}` : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ children, active = false, accent = indigo, style = {} }) {
  return (
    <div
      style={{
        padding: "3px 10px",
        border: `1.2px solid ${ink}`,
        borderRadius: 999,
        background: active ? accent : paper,
        color: active ? "#fff" : ink,
        fontFamily: "'Patrick Hand', cursive",
        fontSize: 12,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Hatched-fill image placeholder */
function ImgBox({ w, h, label, radius = 8, style = {} }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        border: `1.2px solid ${ink}`,
        background:
          "repeating-linear-gradient(135deg, transparent 0 6px, rgba(0,0,0,0.08) 6px 7px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        position: "relative",
        ...style,
      }}
    >
      {label && (
        <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 11, color: muted }}>
          {label}
        </span>
      )}
    </div>
  );
}

function Line({ w = "100%", color = ink, style = {} }) {
  return (
    <div
      style={{
        width: w,
        height: 0,
        borderTop: `1.2px solid ${color}`,
        opacity: 0.4,
        ...style,
      }}
    />
  );
}

function Wave({ w = "70%" }) {
  return (
    <div style={{ width: w, height: 6, background: ink, opacity: 0.18, borderRadius: 3 }} />
  );
}

function Stack({ lines = 3, w = "80%", gap = 4, opacity = 0.25 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width: "100%" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === lines - 1 ? "60%" : w,
            height: 5,
            background: ink,
            opacity,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

/** "scribble" annotation arrow */
function Arrow({ d, color = coral, w = 60, h = 30 }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <path
        d={d || `M 4 ${h - 4} Q ${w / 2} 4 ${w - 6} ${h - 8}`}
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M ${w - 6} ${h - 8} L ${w - 12} ${h - 14} M ${w - 6} ${h - 8} L ${w - 2} ${h - 14}`}
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** sticky note callout */
function Note({ children, color = "#fff5b8", w = 180, rotate = -1.5, style = {} }) {
  return (
    <div
      style={{
        width: w,
        background: color,
        border: `1.2px solid ${ink}`,
        padding: "6px 8px",
        fontFamily: "'Kalam', cursive",
        fontSize: 12,
        color: ink,
        lineHeight: 1.2,
        transform: `rotate(${rotate}deg)`,
        boxShadow: `1px 2px 0 rgba(0,0,0,0.2)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Status bar shown inside a phone */
function PhoneStatus() {
  return (
    <div
      style={{
        position: "absolute",
        top: 4,
        left: 12,
        right: 12,
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "'Patrick Hand', cursive",
        fontSize: 10,
        color: ink,
        opacity: 0.6,
        zIndex: 6,
      }}
    >
      <span>9:41</span>
      <span>● ● ●</span>
    </div>
  );
}

/* Pretty section heading (rendered inside DCSection title via DC) — not used here */

/* Color constants exported via window for cross-script use */
Object.assign(window, {
  Phone,
  Desktop,
  Caption,
  Annot,
  Label,
  H,
  Box,
  Btn,
  Chip,
  ImgBox,
  Line,
  Wave,
  Stack,
  Arrow,
  Note,
  PhoneStatus,
  WF_COLORS: { ink, paper, indigo, coral, muted },
});
