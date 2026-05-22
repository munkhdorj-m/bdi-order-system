/* eslint-disable react/prop-types */
/**
 * R1/R2/R3 — Rep flow (mobile)
 *
 * A) Refined — same store list + per-store detail, tighter cards, "context banner" clearer
 * B) Reorganized — store list with "needs visit" priority + cadence chips
 * C) Exploratory — today's route view (map + ordered visit list), call-from-card,
 *    one-tap "order on behalf" from store card
 */

const Cr = window.WF_COLORS;

/* ---------- A: store list (R1) ---------- */
function RepA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 6px", display: "flex", alignItems: "center", gap: 8 }}>
        <window.Label size={16}>☰</window.Label>
        <window.H size={15}>Миний дэлгүүрүүд</window.H>
        <window.Label size={11} color={Cr.muted} style={{ marginLeft: "auto" }}>8 нийт</window.Label>
      </div>

      <div style={{ padding: "0 10px", flex: 1, overflow: "hidden" }}>
        {[
          { n: "Хүнс-Мини", c: "Б. Энхээ · +976 8811 2233", d: "2 өдрийн өмнө · 4,690₮" },
          { n: "Номин Их Дэлгүүр", c: "Ц. Нямсүрэн · +976 9911 4422", d: "5 өдрийн өмнө · 12,300₮" },
          { n: "CU Tokyo str.", c: "Б. Долгор · +976 8822 1133", d: "Захиалга байхгүй", warn: true },
          { n: "Их Наран", c: "Г. Тэмүүлэн · +976 9988 7766", d: "8 өдрийн өмнө · 5,150₮" },
        ].map((s, i) => (
          <div
            key={s.n}
            style={{
              padding: 10,
              border: `1.2px solid ${Cr.ink}`,
              borderRadius: 8,
              marginBottom: 6,
              background: s.warn ? "#fff4dc" : Cr.paper,
              boxShadow: s.warn ? `1.5px 2px 0 ${Cr.ink}` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <window.Label size={14} weight={700}>🏪 {s.n}</window.Label>
              {s.warn && <span style={{ fontSize: 12 }}>⚠</span>}
            </div>
            <window.Label size={10} color={Cr.muted} style={{ display: "block", marginTop: 2 }}>
              {s.c}
            </window.Label>
            <window.Label size={10} color={s.warn ? Cr.coral : Cr.muted} style={{ display: "block", marginTop: 2 }}>
              {s.d}
            </window.Label>
          </div>
        ))}
      </div>

      <div
        style={{
          height: 50,
          borderTop: `1.5px solid ${Cr.ink}`,
          background: Cr.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        {["🏪", "📋", "📊", "👤"].map((e, i) => (
          <window.Label key={i} size={14} color={i === 0 ? Cr.indigo : Cr.muted}>
            {e}
          </window.Label>
        ))}
      </div>
    </div>
  );
}

/* ---------- B: prioritized store list + cadence ---------- */
function RepB() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 6px" }}>
        <window.H size={16}>Өнөөдөр анхаарах</window.H>
        <window.Label size={11} color={Cr.muted}>Б. Цэрэн · 8 дэлгүүр хариуцагч</window.Label>
      </div>

      {/* tabs */}
      <div style={{ padding: "4px 10px", display: "flex", gap: 6 }}>
        <window.Chip active>⚠ Анхаарах · 3</window.Chip>
        <window.Chip>Бүгд</window.Chip>
        <window.Chip>📍 Ойролцоо</window.Chip>
      </div>

      <div style={{ padding: "4px 10px", flex: 1, overflow: "hidden" }}>
        {[
          {
            n: "CU Tokyo str.",
            why: "12 өдөр захиалга байхгүй",
            tone: Cr.coral,
            actions: ["📞 Утас", "💬 Viber", "+ Захиалга"],
          },
          {
            n: "Хүнс-Мини",
            why: "Ердийн давтамжаас 3 өдөр хоцорсон",
            tone: "#a8771a",
            actions: ["📞 Утас", "+ Захиалга"],
          },
          {
            n: "Их Наран",
            why: "Шинэ бараа танилцуулах",
            tone: Cr.indigo,
            actions: ["+ Захиалга"],
          },
        ].map((s) => (
          <div
            key={s.n}
            style={{
              padding: 10,
              border: `1.5px solid ${Cr.ink}`,
              borderLeft: `4px solid ${s.tone}`,
              borderRadius: 6,
              marginBottom: 8,
              background: Cr.paper,
              boxShadow: `1.5px 2px 0 ${Cr.ink}`,
            }}
          >
            <window.Label size={13} weight={700}>{s.n}</window.Label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: s.tone }} />
              <window.Label size={10} color={Cr.muted}>{s.why}</window.Label>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {s.actions.map((a, i) => (
                <window.Chip key={i} active={i === s.actions.length - 1}>{a}</window.Chip>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", right: -130, top: 200 }}>
        <window.Note w={160} rotate={5}>
          Reps don't browse stores, they react to signals. Priority + cadence гол.
        </window.Note>
      </div>

      <div
        style={{
          height: 48,
          borderTop: `1.5px solid ${Cr.ink}`,
          background: Cr.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        {["🏪", "📋", "📊", "👤"].map((e, i) => (
          <window.Label key={i} size={14} color={i === 0 ? Cr.indigo : Cr.muted}>
            {e}
          </window.Label>
        ))}
      </div>
    </div>
  );
}

/* ---------- C: today's route view ---------- */
function RepC() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 6px" }}>
        <window.H size={16}>Өнөөдрийн маршрут</window.H>
        <window.Label size={11} color={Cr.muted}>Бяр · 5/13 · 4 дэлгүүр</window.Label>
      </div>

      {/* mini map */}
      <div style={{ padding: "0 10px" }}>
        <div
          style={{
            height: 130,
            border: `1.5px solid ${Cr.ink}`,
            borderRadius: 8,
            background:
              "repeating-linear-gradient(0deg, transparent 0 14px, rgba(0,0,0,0.04) 14px 15px), repeating-linear-gradient(90deg, transparent 0 14px, rgba(0,0,0,0.04) 14px 15px), #f4eedb",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* route */}
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <path
              d="M 30 100 Q 80 60 130 80 T 220 50 T 270 90"
              stroke={Cr.indigo}
              strokeWidth="2"
              fill="none"
              strokeDasharray="4 3"
            />
          </svg>
          {[
            { x: 22, y: 92, n: 1, active: true },
            { x: 122, y: 72, n: 2 },
            { x: 212, y: 42, n: 3 },
            { x: 262, y: 82, n: 4 },
          ].map((p) => (
            <div
              key={p.n}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: 22,
                height: 22,
                borderRadius: 11,
                border: `1.5px solid ${Cr.ink}`,
                background: p.active ? Cr.coral : Cr.paper,
                color: p.active ? "#fff" : Cr.ink,
                fontFamily: "'Kalam', cursive",
                fontWeight: 700,
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {p.n}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "8px 10px", flex: 1, overflow: "hidden" }}>
        {[
          { n: 1, name: "Хүнс-Мини", t: "9:00", st: "Дараагийн", a: true },
          { n: 2, name: "CU Tokyo", t: "10:30", st: "хүлээгдэж буй" },
          { n: 3, name: "Их Наран", t: "13:00", st: "хүлээгдэж буй" },
          { n: 4, name: "Номин Их", t: "15:00", st: "хүлээгдэж буй" },
        ].map((s) => (
          <div
            key={s.n}
            style={{
              padding: 8,
              border: `1.2px solid ${Cr.ink}`,
              borderRadius: 6,
              marginBottom: 5,
              background: s.a ? "#eef0ff" : Cr.paper,
              boxShadow: s.a ? `1.5px 2px 0 ${Cr.ink}` : "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                border: `1.5px solid ${Cr.ink}`,
                background: s.a ? Cr.coral : Cr.paper,
                color: s.a ? "#fff" : Cr.ink,
                fontFamily: "'Kalam', cursive",
                fontWeight: 700,
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.n}
            </div>
            <div style={{ flex: 1 }}>
              <window.Label size={12} weight={700}>{s.name}</window.Label>
              <window.Label size={10} color={Cr.muted} style={{ display: "block" }}>{s.t} · {s.st}</window.Label>
            </div>
            {s.a ? (
              <window.Btn h={26} w={null} primary style={{ padding: "0 8px", fontSize: 10 }}>
                + Захиалга
              </window.Btn>
            ) : (
              <window.Label size={14} color={Cr.muted}>›</window.Label>
            )}
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", right: -130, top: 200 }}>
        <window.Note w={160} rotate={4} color="#ffd4cc">
          Reps are field workers — map + ordered route + quick-action card on top.
        </window.Note>
      </div>
    </div>
  );
}

/* ---------- R3: "Order on behalf" context banner (shared mini-screen) ---------- */
function RepOrderOnBehalf() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <window.Label size={16}>←</window.Label>
        <window.Label size={12} weight={700}>Каталог</window.Label>
      </div>

      {/* sticky context banner — the moment-of-truth rep UX */}
      <div
        style={{
          margin: "4px 10px",
          padding: 8,
          background: "#fff4dc",
          border: `1.5px solid ${Cr.ink}`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: `1.5px 2px 0 ${Cr.ink}`,
        }}
      >
        <window.Label size={14}>📋</window.Label>
        <div style={{ flex: 1 }}>
          <window.Label size={11} weight={700}>Хүнс-Мини-н нэрийн өмнөөс</window.Label>
          <window.Label size={9} color={Cr.muted} style={{ display: "block" }}>
            Үнэ нь тус дэлгүүрийн override-ийн дагуу
          </window.Label>
        </div>
        <window.Label size={10} color={Cr.indigo}>Солих ›</window.Label>
      </div>

      <div style={{ padding: "4px 10px" }}>
        <div
          style={{
            border: `1.2px solid ${Cr.ink}`,
            borderRadius: 999,
            padding: "5px 10px",
            fontFamily: "'Patrick Hand', cursive",
            fontSize: 11,
            color: Cr.muted,
            background: "#fff",
          }}
        >
          🔍 Хайх…
        </div>
      </div>

      <div style={{ padding: "8px 10px", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                border: `1.2px solid ${Cr.ink}`,
                borderRadius: 8,
                padding: 5,
                background: Cr.paper,
              }}
            >
              <window.ImgBox w="100%" h={56} radius={4} />
              <window.Label size={10} weight={700} style={{ display: "block", marginTop: 3, lineHeight: 1.1 }}>
                Soft Leaf 10ш
              </window.Label>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <window.Label size={11} weight={700}>1,180₮</window.Label>
                <span style={{ color: Cr.indigo, fontSize: 9, fontFamily: "'Patrick Hand', cursive" }}>store ↓</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: `1.5px solid ${Cr.ink}`,
          background: "#fdfaef",
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <window.Label size={10} color={Cr.muted}>🛒 2 бараа · 2,360₮</window.Label>
        <div style={{ marginLeft: "auto" }}>
          <window.Btn h={30} w={null} primary style={{ padding: "0 12px", fontSize: 11 }}>
            Сагс →
          </window.Btn>
        </div>
      </div>
    </div>
  );
}

window.RepA = RepA;
window.RepB = RepB;
window.RepC = RepC;
window.RepOrderOnBehalf = RepOrderOnBehalf;
