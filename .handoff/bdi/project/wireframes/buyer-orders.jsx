/* eslint-disable react/prop-types */
/**
 * B6 — Buyer orders list + detail
 *
 * A) Refined — cleaner card list with clearer status pills, search
 * B) Reorganized — status-tabbed (Идэвхтэй / Хүргэгдсэн / Цуцалсан)
 *    + per-order reorder button
 * C) Exploratory — timeline view: orders as a vertical schedule with delivery dates
 */

const C5 = window.WF_COLORS;

function StatusPill({ s, color }) {
  return (
    <div
      style={{
        padding: "1px 6px",
        background: color,
        color: "#fff",
        fontFamily: "'Patrick Hand', cursive",
        fontSize: 10,
        borderRadius: 4,
        border: `1px solid ${C5.ink}`,
        whiteSpace: "nowrap",
      }}
    >
      {s}
    </div>
  );
}

function OrdersA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 6px" }}>
        <window.H size={16}>Захиалгууд</window.H>
        <div
          style={{
            marginTop: 8,
            border: `1.2px solid ${C5.ink}`,
            borderRadius: 999,
            padding: "5px 10px",
            fontFamily: "'Patrick Hand', cursive",
            fontSize: 11,
            color: C5.muted,
          }}
        >
          🔍 Захиалгын дугаар, огноо…
        </div>
      </div>

      <div style={{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: 6, flex: 1, overflow: "hidden" }}>
        {[
          { n: "ORD-2026-00042", d: "5/11", t: "4,690₮", s: "Хүлээгдэж буй", c: "#e8a13a" },
          { n: "ORD-2026-00038", d: "5/08", t: "12,300₮", s: "Хүргэгдсэн", c: "#3a9a5e" },
          { n: "ORD-2026-00033", d: "5/05", t: "8,150₮", s: "Илгээсэн", c: C5.indigo },
          { n: "ORD-2026-00029", d: "4/28", t: "5,420₮", s: "Хүргэгдсэн", c: "#3a9a5e" },
          { n: "ORD-2026-00024", d: "4/19", t: "2,250₮", s: "Цуцалсан", c: "#777" },
        ].map((o, i) => (
          <div
            key={i}
            style={{
              border: `1.2px solid ${C5.ink}`,
              borderRadius: 8,
              padding: 8,
              background: i === 0 ? "#fdfaef" : C5.paper,
              boxShadow: i === 0 ? `1.5px 2px 0 ${C5.ink}` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <window.Label size={11} weight={700} style={{ fontFamily: "monospace" }}>
                {o.n}
              </window.Label>
              <StatusPill s={o.s} color={o.c} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <window.Label size={10} color={C5.muted}>{o.d} · 3 бараа</window.Label>
              <window.Label size={12} weight={700}>{o.t}</window.Label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersB() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 4px" }}>
        <window.H size={16}>Захиалгууд</window.H>
      </div>

      {/* tab control */}
      <div style={{ display: "flex", padding: "6px 10px", gap: 6 }}>
        {["Идэвхтэй · 4", "Хүргэгдсэн", "Бүгд"].map((t, i) => (
          <div
            key={t}
            style={{
              padding: "5px 10px",
              border: `1.2px solid ${C5.ink}`,
              borderRadius: 999,
              background: i === 0 ? C5.indigo : C5.paper,
              color: i === 0 ? "#fff" : C5.ink,
              fontFamily: "'Kalam', cursive",
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            {t}
          </div>
        ))}
      </div>

      <div style={{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {[
          { n: "ORD-…42", d: "5/11", s: "🟡 Хүлээгдэж буй", t: "4,690₮", btn: false },
          { n: "ORD-…40", d: "5/10", s: "🟦 Багцлаж байна", t: "27,400₮", btn: false },
          { n: "ORD-…38", d: "5/08", s: "🟢 Илгээсэн", t: "12,300₮", btn: true },
        ].map((o, i) => (
          <div
            key={i}
            style={{
              border: `1.2px solid ${C5.ink}`,
              borderRadius: 10,
              padding: 10,
              background: C5.paper,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <window.Label size={11} weight={700} style={{ fontFamily: "monospace" }}>{o.n}</window.Label>
              <window.Label size={12} weight={700}>{o.t}</window.Label>
            </div>
            <window.Label size={10} color={C5.muted} style={{ display: "block", marginTop: 2 }}>
              {o.d} · 3 бараа · {o.s}
            </window.Label>

            {/* mini progress */}
            <div style={{ marginTop: 6, display: "flex", gap: 3, alignItems: "center" }}>
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: step <= (i === 0 ? 1 : i === 1 ? 2 : 3) ? C5.indigo : "#ddd",
                    border: `1px solid ${C5.ink}`,
                  }}
                />
              ))}
            </div>

            {o.btn && (
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <window.Btn h={28} w={null} style={{ flex: 1, fontSize: 11, padding: "0 10px" }}>
                  Дахин захиалах
                </window.Btn>
                <window.Btn h={28} w={null} ghost style={{ flex: 1, fontSize: 11, color: C5.indigo }}>
                  Дэлгэрэнгүй →
                </window.Btn>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", right: -120, top: 260 }}>
        <window.Note w={150} rotate={4}>
          Mini progress bar = статус нэг харахад ойлгомжтой
        </window.Note>
      </div>
    </div>
  );
}

function OrdersC() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 12px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <window.H size={16}>Хуанли</window.H>
        <div style={{ display: "flex", gap: 4 }}>
          <window.Chip active>Хуанли</window.Chip>
          <window.Chip>Жагсаалт</window.Chip>
        </div>
      </div>

      <window.Label size={10} color={C5.muted} style={{ padding: "0 12px" }}>5-р сар, 2026</window.Label>

      <div style={{ padding: 10, flex: 1, overflow: "hidden" }}>
        {[
          { d: "Лха · 5/15", future: true, items: [{ label: "Дараагийн ердийн захиалга?", suggest: true }] },
          { d: "Бяр · 5/13", future: true, items: [{ n: "ORD-…42", s: "🟡 Хүргэлт хүлээж буй", t: "4,690₮" }] },
          { d: "Лха · 5/08", future: false, items: [{ n: "ORD-…38", s: "🟢 Хүргэгдсэн", t: "12,300₮" }] },
          { d: "Дав · 5/05", future: false, items: [{ n: "ORD-…33", s: "🟢 Хүргэгдсэн", t: "8,150₮" }] },
        ].map((day, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {/* timeline dot */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 6,
                  background: day.future ? C5.paper : C5.indigo,
                  border: `1.5px solid ${C5.ink}`,
                  marginTop: 3,
                }}
              />
              {i < 3 && <div style={{ width: 1.5, flex: 1, background: C5.ink, opacity: 0.4 }} />}
            </div>
            <div style={{ flex: 1 }}>
              <window.Label size={10} weight={700} color={day.future ? C5.indigo : C5.ink}>{day.d}</window.Label>
              {day.items.map((it, j) =>
                it.suggest ? (
                  <div
                    key={j}
                    style={{
                      marginTop: 3,
                      padding: 6,
                      border: `1.5px dashed ${C5.indigo}`,
                      borderRadius: 6,
                      background: "#eef0ff",
                    }}
                  >
                    <window.Label size={11} weight={700} color={C5.indigo}>+ Захиалга үүсгэх?</window.Label>
                    <window.Label size={9} color={C5.muted} style={{ display: "block" }}>
                      Та ердөө 7 хоног тутамд авдаг
                    </window.Label>
                  </div>
                ) : (
                  <div
                    key={j}
                    style={{
                      marginTop: 3,
                      padding: 6,
                      border: `1.2px solid ${C5.ink}`,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <window.Label size={11} weight={700} style={{ fontFamily: "monospace" }}>{it.n}</window.Label>
                      <window.Label size={11} weight={700}>{it.t}</window.Label>
                    </div>
                    <window.Label size={9} color={C5.muted}>{it.s}</window.Label>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: -130, top: 200 }}>
        <window.Note w={160} rotate={-4} color="#ffd4cc">
          B2B = repeated cadence. Хуанли дээр давтамж нь харагдана!
        </window.Note>
      </div>
    </div>
  );
}

window.OrdersA = OrdersA;
window.OrdersB = OrdersB;
window.OrdersC = OrdersC;
