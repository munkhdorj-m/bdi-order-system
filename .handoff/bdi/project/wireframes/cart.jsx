/* eslint-disable react/prop-types */
/**
 * B4 — Buyer cart
 *
 * A) Refined — same layout, tighter line items, persistent sticky total
 * B) Reorganized — group by category, collapsible sections, sticky summary card at top
 * C) Exploratory — "Frequently ordered together" suggestion strip + delivery slot picker
 */

const C4 = window.WF_COLORS;

function CartLineRefined({ qty }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 8,
        border: `1.2px solid ${C4.ink}`,
        borderRadius: 8,
        background: C4.paper,
        alignItems: "center",
      }}
    >
      <window.ImgBox w={44} h={44} radius={6} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <window.Label size={9} color={C4.indigo}>SOFT LEAF</window.Label>
        <window.Label size={11} weight={700} style={{ display: "block", lineHeight: 1.1 }}>
          Салфетка 10ш
        </window.Label>
        <window.Label size={10} color={C4.muted}>1,220₮ × {qty} = {(1220 * qty).toLocaleString()}₮</window.Label>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1.2px solid ${C4.ink}`,
          borderRadius: 14,
          fontFamily: "'Kalam', cursive",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span style={{ padding: "3px 7px" }}>−</span>
        <span style={{ padding: "3px 6px", background: C4.indigo, color: "#fff" }}>{qty}</span>
        <span style={{ padding: "3px 7px" }}>+</span>
      </div>
    </div>
  );
}

function CartA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 4px" }}>
        <window.H size={18}>Миний сагс</window.H>
        <window.Label size={11} color={C4.muted}>3 ширхэг · 4,690₮</window.Label>
      </div>

      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <CartLineRefined qty={2} />
        <CartLineRefined qty={1} />
        <CartLineRefined qty={3} />
      </div>

      <div style={{ padding: "8px 10px", flex: 1 }}>
        <window.Label size={11} weight={700} style={{ display: "block", marginBottom: 4 }}>
          📝 Тэмдэглэл (заавал биш)
        </window.Label>
        <window.Box w="100%" h={50} radius={8} dashed>
          <div style={{ padding: 6 }}>
            <window.Label size={10} color={C4.muted}>Жш: Маргааш 10цаг хүртэл хүргэх...</window.Label>
          </div>
        </window.Box>
      </div>

      <div style={{ position: "absolute", right: -110, top: 230 }}>
        <window.Note w={150} rotate={4}>
          Swipe-to-delete нэмж үзвэл? Trash button ялгахгүй болгож байна.
        </window.Note>
      </div>

      <div
        style={{
          borderTop: `1.5px solid ${C4.ink}`,
          background: "#fdfaef",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <window.Label size={10} color={C4.muted}>Нийт</window.Label>
          <window.Label size={18} weight={700} style={{ display: "block" }}>4,690₮</window.Label>
        </div>
        <div style={{ flex: 1 }}>
          <window.Btn primary h={42}>Захиалга илгээх</window.Btn>
        </div>
      </div>
    </div>
  );
}

function CartB() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 4px" }}>
        <window.H size={16}>Сагс</window.H>
      </div>

      {/* sticky summary card */}
      <div style={{ padding: "4px 10px" }}>
        <div
          style={{
            border: `1.5px solid ${C4.ink}`,
            borderRadius: 10,
            background: "#eef0ff",
            padding: 10,
            display: "flex",
            gap: 8,
            alignItems: "center",
            boxShadow: `1.5px 2px 0 ${C4.ink}`,
          }}
        >
          <div>
            <window.Label size={9} color={C4.muted}>3 ширхэг</window.Label>
            <window.Label size={18} weight={700} style={{ display: "block" }}>4,690₮</window.Label>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <window.Btn primary h={32} w={120} style={{ fontSize: 12 }}>Илгээх →</window.Btn>
          </div>
        </div>
      </div>

      {/* grouped by category */}
      <div style={{ padding: "8px 10px", flex: 1, overflow: "hidden" }}>
        {[
          { c: "Цаас", n: 2, open: true },
          { c: "Хөвөн", n: 1, open: false },
        ].map((g) => (
          <div key={g.c} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 8px",
                background: "#f2ecd9",
                border: `1px solid ${C4.ink}`,
                borderRadius: 6,
                marginBottom: 4,
              }}
            >
              <window.Label size={11} weight={700}>{g.open ? "▼" : "▶"} {g.c}</window.Label>
              <window.Label size={10} color={C4.muted} style={{ marginLeft: "auto" }}>{g.n} бараа</window.Label>
            </div>
            {g.open && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <CartLineRefined qty={2} />
                <CartLineRefined qty={1} />
              </div>
            )}
          </div>
        ))}
        <window.Box w="100%" h={36} radius={6} dashed>
          <div style={{ padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <window.Label size={11} color={C4.indigo}>+ Бараа нэмэх</window.Label>
          </div>
        </window.Box>
      </div>

      <div style={{ position: "absolute", left: -120, top: 240 }}>
        <window.Note w={160} rotate={-3}>
          Сагсыг ангиллаар бүлэглэнэ → нийт зураг тодорхой
        </window.Note>
      </div>
    </div>
  );
}

function CartC() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 4px" }}>
        <window.H size={16}>Сагс</window.H>
      </div>

      <div style={{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <CartLineRefined qty={2} />
        <CartLineRefined qty={1} />
      </div>

      {/* delivery */}
      <div style={{ padding: "8px 10px" }}>
        <window.Label size={11} weight={700} style={{ display: "block", marginBottom: 6 }}>
          🚚 Хүргэлтийн өдөр
        </window.Label>
        <div style={{ display: "flex", gap: 5 }}>
          {[
            { d: "Бяр", n: "13", a: true },
            { d: "Дав", n: "16" },
            { d: "Мяг", n: "17" },
            { d: "Лха", n: "18" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                border: `1.5px solid ${C4.ink}`,
                borderRadius: 8,
                padding: "5px 0",
                textAlign: "center",
                background: s.a ? C4.indigo : C4.paper,
                color: s.a ? "#fff" : C4.ink,
                fontFamily: "'Kalam', cursive",
              }}
            >
              <div style={{ fontSize: 9 }}>{s.d}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{s.n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* suggested */}
      <div style={{ padding: "8px 10px" }}>
        <window.Label size={11} weight={700} style={{ display: "block", marginBottom: 4 }}>
          ✨ Хамт авдаг бараа
        </window.Label>
        <div style={{ display: "flex", gap: 5, overflow: "hidden" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                minWidth: 78,
                border: `1.2px solid ${C4.ink}`,
                borderRadius: 6,
                padding: 4,
                position: "relative",
              }}
            >
              <window.ImgBox w="100%" h={38} radius={3} />
              <window.Label size={9} style={{ display: "block", lineHeight: 1, marginTop: 2 }}>
                Хөвөн 50ш
              </window.Label>
              <window.Label size={9} weight={700}>2,150₮</window.Label>
              <div
                style={{
                  position: "absolute",
                  bottom: 3,
                  right: 3,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: C4.indigo,
                  color: "#fff",
                  fontSize: 10,
                  fontFamily: "'Kalam', cursive",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: -130, top: 220 }}>
        <window.Note w={160} rotate={4} color="#ffd4cc">
          Хүргэлтийн slot + suggestions = AOV ↑, заавал биш
        </window.Note>
      </div>

      <div
        style={{
          marginTop: "auto",
          borderTop: `1.5px solid ${C4.ink}`,
          background: "#fdfaef",
          padding: "10px 12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <window.Label size={10} color={C4.muted}>3 бараа</window.Label>
          <window.Label size={10} color={C4.muted}>Бяр, 5/13 хүргэлт</window.Label>
        </div>
        <window.Btn primary h={42}>Захиалах · 4,690₮</window.Btn>
      </div>
    </div>
  );
}

window.CartA = CartA;
window.CartB = CartB;
window.CartC = CartC;
