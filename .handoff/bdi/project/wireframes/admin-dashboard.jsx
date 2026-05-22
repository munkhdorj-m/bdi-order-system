/* eslint-disable react/prop-types */
/**
 * A2 — Admin dashboard
 *
 * A) Refined — KPI strip + recent orders list (same as today, tighter)
 * B) Reorganized — Pending-orders queue front-and-center; KPIs as secondary strip
 * C) Exploratory — Kanban board of orders by status; admin drags between columns
 */

const C6 = window.WF_COLORS;

function Sidebar({ active = "Дашбоард" }) {
  return (
    <div
      style={{
        width: 140,
        borderRight: `1.5px solid ${C6.ink}`,
        background: "#f4eedb",
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 6px",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: C6.indigo,
            color: "#fff",
            fontFamily: "'Kalam', cursive",
            fontWeight: 700,
            fontSize: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          BDI
        </div>
        <window.Label size={11} weight={700}>Admin</window.Label>
      </div>
      {["🏠 Дашбоард", "📦 Захиалга", "🛒 Бараа", "🏪 Дэлгүүр", "💵 Үнэ", "👥 Хэрэглэгч"].map((item) => {
        const a = item.endsWith(active);
        return (
          <div
            key={item}
            style={{
              padding: "5px 8px",
              borderRadius: 5,
              background: a ? C6.indigo : "transparent",
              color: a ? "#fff" : C6.ink,
              fontFamily: "'Kalam', cursive",
              fontSize: 11,
              fontWeight: a ? 700 : 400,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, tone = C6.ink, alert }) {
  return (
    <div
      style={{
        flex: 1,
        border: `1.5px solid ${C6.ink}`,
        borderRadius: 8,
        padding: 10,
        background: alert ? "#fff4dc" : C6.paper,
        boxShadow: alert ? `1.5px 2px 0 ${C6.ink}` : "none",
        position: "relative",
      }}
    >
      <window.Label size={10} color={C6.muted}>{label}</window.Label>
      <div
        style={{
          fontFamily: "'Kalam', cursive",
          fontSize: 22,
          fontWeight: 700,
          color: tone,
        }}
      >
        {value}
      </div>
      {alert && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: 4,
            background: C6.coral,
            border: `1px solid ${C6.ink}`,
          }}
        />
      )}
    </div>
  );
}

function DashA() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 18, overflow: "hidden" }}>
        <window.H size={20}>Дашбоард</window.H>
        <window.Label size={11} color={C6.muted}>Өнөөдөр · 5/11</window.Label>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <KpiCard label="Шинэ захиалга" value="12" tone={C6.coral} alert />
          <KpiCard label="Багцлаж буй" value="5" />
          <KpiCard label="Илгээсэн" value="3" />
          <KpiCard label="7 хоног нийт" value="1.4M ₮" tone={C6.indigo} />
        </div>

        <div style={{ marginTop: 18 }}>
          <window.Label size={13} weight={700}>Сүүлийн захиалга</window.Label>
          <div style={{ marginTop: 6, border: `1.5px solid ${C6.ink}`, borderRadius: 8 }}>
            {[
              { n: "ORD-…42", st: "Хүнс-Мини", t: "4,690₮", a: "5 мин өмнө" },
              { n: "ORD-…41", st: "Номин Их", t: "12,300₮", a: "20 мин өмнө" },
              { n: "ORD-…40", st: "CU Tokyo", t: "27,400₮", a: "1 цаг өмнө" },
              { n: "ORD-…39", st: "Хүнс-Мини", t: "5,150₮", a: "3 цаг өмнө" },
            ].map((o, i, arr) => (
              <div
                key={o.n}
                style={{
                  padding: "8px 12px",
                  borderBottom: i < arr.length - 1 ? `1px dashed ${C6.ink}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <window.Label size={11} weight={700} style={{ fontFamily: "monospace", width: 80 }}>{o.n}</window.Label>
                <window.Label size={11} style={{ width: 100 }}>{o.st}</window.Label>
                <window.Label size={10} color={C6.muted} style={{ flex: 1 }}>{o.a}</window.Label>
                <window.Label size={12} weight={700}>{o.t}</window.Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashB() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <window.H size={20}>Шинэ захиалга</window.H>
          <window.Annot size={16} color={C6.coral}>12 ширхэг</window.Annot>
        </div>

        {/* big actionable queue */}
        <div
          style={{
            marginTop: 12,
            border: `1.8px solid ${C6.ink}`,
            borderRadius: 10,
            background: C6.paper,
            boxShadow: `2px 3px 0 ${C6.ink}`,
          }}
        >
          <div
            style={{
              background: "#fff4dc",
              padding: "6px 12px",
              borderBottom: `1.5px solid ${C6.ink}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <window.Label size={11} weight={700}>📥 Хүлээгдэж буй</window.Label>
            <window.Label size={10} color={C6.muted}>Хуучнаас шинэ рүү</window.Label>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <window.Chip>Бүгд</window.Chip>
              <window.Chip active>Шинэ</window.Chip>
              <window.Chip>Багцлаж буй</window.Chip>
            </div>
          </div>
          {[
            { n: "ORD-…42", st: "Хүнс-Мини", a: "5 мин", t: "4,690₮", note: "Маргааш 10ц хүртэл хүргэх" },
            { n: "ORD-…41", st: "Номин Их", a: "20 мин", t: "12,300₮" },
            { n: "ORD-…40", st: "CU Tokyo", a: "1 цаг", t: "27,400₮" },
            { n: "ORD-…39", st: "Их Наран", a: "3 цаг", t: "5,150₮" },
          ].map((o, i) => (
            <div
              key={o.n}
              style={{
                padding: "10px 12px",
                borderBottom: `1px dashed ${C6.ink}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <window.Label size={11} weight={700} style={{ fontFamily: "monospace", width: 82 }}>{o.n}</window.Label>
              <div style={{ flex: 1 }}>
                <window.Label size={12} weight={700}>{o.st}</window.Label>
                <window.Label size={10} color={C6.muted} style={{ display: "block" }}>
                  {o.a} өмнө · 3 бараа{o.note && ` · "${o.note}"`}
                </window.Label>
              </div>
              <window.Label size={13} weight={700} style={{ width: 80, textAlign: "right" }}>{o.t}</window.Label>
              <window.Btn h={28} w={null} style={{ padding: "0 10px", fontSize: 11 }}>Үзэх</window.Btn>
              <window.Btn h={28} w={null} primary style={{ padding: "0 10px", fontSize: 11 }}>
                ✓ Баталгаажуулах
              </window.Btn>
            </div>
          ))}
        </div>

        {/* small KPI strip below */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <KpiCard label="Багцлаж буй" value="5" />
          <KpiCard label="Илгээсэн" value="3" />
          <KpiCard label="7 хоног" value="1.4M ₮" tone={C6.indigo} />
        </div>

        <div style={{ position: "absolute", right: 8, top: 60 }}>
          <window.Note w={140} rotate={5}>
            Action-first: KPI биш, хийх ажил
          </window.Note>
        </div>
      </div>
    </div>
  );
}

function DashC() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar active="Захиалга" />
      <div style={{ flex: 1, padding: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <window.H size={18}>Захиалгын самбар</window.H>
          <window.Label size={10} color={C6.muted}>(Kanban)</window.Label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <window.Chip>Өнөөдөр</window.Chip>
            <window.Chip active>Энэ долоо хоног</window.Chip>
            <window.Chip>Сар</window.Chip>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, height: 360 }}>
          {[
            { t: "🟡 Шинэ", n: 12, tint: "#fff4dc", count: 4 },
            { t: "🟦 Багцлаж", n: 5, tint: "#eef0ff", count: 3 },
            { t: "🚚 Илгээсэн", n: 3, tint: "#eafff0", count: 2 },
            { t: "🟢 Хүргэгдсэн", n: 24, tint: "#f4eedb", count: 2 },
          ].map((col, ci) => (
            <div
              key={col.t}
              style={{
                flex: 1,
                background: col.tint,
                border: `1.5px solid ${C6.ink}`,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "6px 8px",
                  borderBottom: `1.2px solid ${C6.ink}`,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <window.Label size={11} weight={700}>{col.t}</window.Label>
                <window.Label size={11} weight={700} color={C6.muted}>{col.n}</window.Label>
              </div>
              <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                {Array.from({ length: col.count }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#fff",
                      border: `1.2px solid ${C6.ink}`,
                      borderRadius: 6,
                      padding: 6,
                      boxShadow: `1px 1px 0 ${C6.ink}`,
                      transform: ci === 1 && i === 0 ? "rotate(-2deg)" : "none",
                    }}
                  >
                    <window.Label size={9} weight={700} style={{ fontFamily: "monospace" }}>ORD-…{40 + ci + i}</window.Label>
                    <window.Label size={9} color={C6.muted} style={{ display: "block" }}>
                      Хүнс-Мини
                    </window.Label>
                    <window.Label size={10} weight={700} style={{ display: "block", marginTop: 2 }}>
                      4,690₮
                    </window.Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", right: 14, top: 70 }}>
          <window.Note w={140} rotate={3} color="#ffd4cc">
            Drag-and-drop status солих. Warehouse-д хурдан.
          </window.Note>
        </div>
      </div>
    </div>
  );
}

window.DashA = DashA;
window.DashB = DashB;
window.DashC = DashC;
window.AdminSidebar = Sidebar;
