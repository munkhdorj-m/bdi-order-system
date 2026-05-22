/* eslint-disable react/prop-types */
/**
 * B2 — Buyer catalog
 *
 * A) Refined — tighter card, inline qty stepper so re-orders skip product detail
 * B) Reorganized — list view default + filter sidebar; running cart pinned at right
 * C) Exploratory — top "Дахин захиалах" rail of last-ordered SKUs; voice/scan search
 */

const C2 = window.WF_COLORS;

function ProductCard({ inCart, ribbon, qty = 0 }) {
  return (
    <div
      style={{
        border: `1.5px solid ${C2.ink}`,
        borderRadius: 10,
        background: C2.paper,
        padding: 6,
        boxShadow: inCart ? `1.5px 2px 0 ${C2.indigo}` : "none",
        position: "relative",
      }}
    >
      {ribbon && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            background: C2.coral,
            color: "#fff",
            fontFamily: "'Patrick Hand', cursive",
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            zIndex: 2,
          }}
        >
          {ribbon}
        </div>
      )}
      <window.ImgBox w="100%" h={66} radius={6} label="" />
      <div style={{ marginTop: 4 }}>
        <window.Label size={9} color={C2.indigo} style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Soft Leaf
        </window.Label>
        <window.Label size={11} style={{ display: "block", lineHeight: 1.1 }}>
          Салфетка 10ш
        </window.Label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
          <window.Label size={12} weight={700}>1,220₮</window.Label>
          {qty > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: `1.2px solid ${C2.ink}`,
                borderRadius: 12,
                fontFamily: "'Kalam', cursive",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <span style={{ padding: "2px 6px" }}>−</span>
              <span style={{ padding: "2px 4px", background: C2.indigo, color: "#fff" }}>{qty}</span>
              <span style={{ padding: "2px 6px" }}>+</span>
            </div>
          ) : (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                border: `1.2px solid ${C2.ink}`,
                background: C2.indigo,
                color: "#fff",
                fontFamily: "'Kalam', cursive",
                fontWeight: 700,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- A: refined ---------- */
function CatalogA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      {/* top bar */}
      <div
        style={{
          padding: "20px 12px 8px",
          borderBottom: `1.2px solid ${C2.ink}`,
          background: C2.paper,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Kalam', cursive", fontWeight: 700, fontSize: 16 }}>☰ BDI</span>
          <div
            style={{
              flex: 1,
              border: `1.2px solid ${C2.ink}`,
              borderRadius: 999,
              padding: "4px 10px",
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 11,
              color: C2.muted,
              background: "#fff",
            }}
          >
            🔍 Барааны нэр, бренд…
          </div>
          <div style={{ position: "relative" }}>
            <window.Label size={18}>🛒</window.Label>
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -6,
                width: 14,
                height: 14,
                background: C2.coral,
                color: "#fff",
                borderRadius: 7,
                fontFamily: "'Kalam', cursive",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              3
            </span>
          </div>
        </div>
        {/* chips */}
        <div style={{ display: "flex", gap: 5, marginTop: 8, overflow: "hidden" }}>
          <window.Chip active>Бүгд</window.Chip>
          <window.Chip>Цаас</window.Chip>
          <window.Chip>Хөвөн</window.Chip>
          <window.Chip>Угаалга</window.Chip>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "8px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <window.Label size={10} color={C2.muted}>48 бараа</window.Label>
          <window.Label size={10} color={C2.muted}>Үнэ ↑</window.Label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <ProductCard qty={2} inCart />
          <ProductCard qty={1} inCart />
          <ProductCard />
          <ProductCard ribbon="ХЯМД" />
          <ProductCard />
          <ProductCard />
        </div>
      </div>

      <div style={{ position: "absolute", right: -110, top: 220 }}>
        <window.Note w={150} rotate={5}>
          Inline qty stepper = detail page руу очихгүй re-order
        </window.Note>
      </div>

      {/* tab bar */}
      <div
        style={{
          height: 50,
          borderTop: `1.2px solid ${C2.ink}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          background: C2.paper,
        }}
      >
        {["Каталог", "Сагс", "Захиалга", "Профайл"].map((t, i) => (
          <div key={t} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14 }}>{["🏠", "🛒", "📋", "👤"][i]}</div>
            <window.Label size={9} color={i === 0 ? C2.indigo : C2.muted}>{t}</window.Label>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- B: reorganized list + sticky cart preview ---------- */
function CatalogB() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "20px 12px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <window.H size={16}>Каталог</window.H>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <window.Chip>☰ Жагсаалт</window.Chip>
            <window.Chip>▦ Сүлжээ</window.Chip>
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            border: `1.2px solid ${C2.ink}`,
            borderRadius: 999,
            padding: "5px 10px",
            fontFamily: "'Patrick Hand', cursive",
            fontSize: 11,
            color: C2.muted,
            background: "#fff",
          }}
        >
          🔍 Хайх… <span style={{ float: "right" }}>🎙</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          <window.Chip active>Цаас</window.Chip>
          <window.Chip>+ Шүүлтүүр</window.Chip>
        </div>
      </div>

      {/* list rows */}
      <div style={{ flex: 1, overflow: "hidden", padding: "4px 10px 10px" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 4px",
              borderBottom: `1px dashed ${C2.ink}`,
              alignItems: "center",
            }}
          >
            <window.ImgBox w={44} h={44} radius={6} />
            <div style={{ flex: 1 }}>
              <window.Label size={9} color={C2.indigo} style={{ textTransform: "uppercase" }}>Soft Leaf</window.Label>
              <window.Label size={11} style={{ display: "block", lineHeight: 1.1 }}>
                Салфетка 10ш · Хайрцагт 120ш
              </window.Label>
              <window.Label size={11} weight={700} style={{ display: "block", marginTop: 2 }}>
                1,220₮
              </window.Label>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: `1.2px solid ${C2.ink}`,
                borderRadius: 14,
                fontFamily: "'Kalam', cursive",
                fontSize: 12,
                fontWeight: 700,
                background: i <= 2 ? "#fff" : "transparent",
              }}
            >
              <span style={{ padding: "3px 7px" }}>−</span>
              <span style={{ padding: "3px 6px", background: i <= 2 ? C2.indigo : "transparent", color: i <= 2 ? "#fff" : C2.ink }}>
                {i <= 2 ? i : 0}
              </span>
              <span style={{ padding: "3px 7px" }}>+</span>
            </div>
          </div>
        ))}
      </div>

      {/* sticky cart preview */}
      <div
        style={{
          borderTop: `1.5px solid ${C2.ink}`,
          padding: "6px 10px",
          background: "#eef0ff",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <window.Label size={11} weight={700}>🛒 3 бараа · 4,690₮</window.Label>
        <div style={{ marginLeft: "auto" }}>
          <window.Btn primary h={28} w={88} style={{ fontSize: 11 }}>Сагс →</window.Btn>
        </div>
      </div>

      <div style={{ position: "absolute", left: -110, top: 280 }}>
        <window.Note w={150} rotate={-4}>
          Жагсаалт = density ↑. Cart preview = тогтмол context.
        </window.Note>
      </div>
    </div>
  );
}

/* ---------- C: exploratory ---------- */
function CatalogC() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "20px 12px 6px" }}>
        <window.H size={16}>Сайн уу, Энхээ</window.H>
        <window.Label size={11} color={C2.muted}>Хүнс-Мини · 5/11 сүүлийн захиалга</window.Label>
      </div>

      {/* Quick reorder rail */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <window.Label size={11} weight={700}>⚡ Дахин захиалах</window.Label>
          <window.Label size={10} color={C2.indigo}>Сүүлийн захиалгаас</window.Label>
        </div>
        <div style={{ display: "flex", gap: 6, overflow: "hidden" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                minWidth: 80,
                border: `1.2px solid ${C2.ink}`,
                borderRadius: 8,
                padding: 4,
                background: C2.paper,
                position: "relative",
              }}
            >
              <window.ImgBox w="100%" h={42} radius={4} />
              <window.Label size={9} style={{ display: "block", lineHeight: 1, marginTop: 3 }}>
                Soft Leaf 10ш
              </window.Label>
              <window.Label size={9} color={C2.muted}>Сүүлд: ×3</window.Label>
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: C2.indigo,
                  color: "#fff",
                  fontSize: 11,
                  fontFamily: "'Kalam', cursive",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                +
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 10px" }}>
        <div
          style={{
            border: `1.2px solid ${C2.ink}`,
            borderRadius: 999,
            padding: "5px 10px",
            fontFamily: "'Patrick Hand', cursive",
            fontSize: 11,
            color: C2.muted,
            background: "#fff",
            display: "flex",
            alignItems: "center",
          }}
        >
          🔍 Хайх…
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>🎙 📷</span>
        </div>
      </div>

      <div style={{ padding: "8px 10px", flex: 1, overflow: "hidden" }}>
        <window.Label size={11} weight={700} style={{ display: "block", marginBottom: 6 }}>
          Бүх бараа
        </window.Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <ProductCard ribbon="ШИНЭ" />
          <ProductCard />
          <ProductCard />
          <ProductCard />
        </div>
      </div>

      <div style={{ position: "absolute", right: -130, top: 180 }}>
        <window.Note w={160} rotate={4} color="#ffd4cc">
          B2B = re-order behavior. Энд "сүүлд авсан" rail хамгийн чухал!
        </window.Note>
      </div>

      <div
        style={{
          height: 48,
          borderTop: `1.2px solid ${C2.ink}`,
          background: C2.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        {["🏠", "🔍", "🛒", "👤"].map((e, i) => (
          <window.Label key={i} size={14} color={i === 0 ? C2.indigo : C2.muted}>
            {e}
          </window.Label>
        ))}
      </div>
    </div>
  );
}

window.CatalogA = CatalogA;
window.CatalogB = CatalogB;
window.CatalogC = CatalogC;
