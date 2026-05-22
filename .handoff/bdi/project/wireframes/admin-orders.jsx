/* eslint-disable react/prop-types */
/**
 * A3/A4 — Admin orders list + detail
 *
 * A) Refined — table-only with cleaner status pills + saved filters
 * B) Reorganized — master-detail: list on left, selected order detail on right
 *    (replaces today's separate /admin/orders/[id] page for fast triage)
 * C) Exploratory — kanban already covered in dashboard C; here:
 *    "fulfillment mode" full-screen — one order at a time with big actions
 */

const C7 = window.WF_COLORS;

function OrdAdminA() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Захиалга" />
      <div style={{ flex: 1, padding: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <window.H size={20}>Захиалгууд</window.H>
          <window.Label size={11} color={C7.muted}>247 нийт</window.Label>
          <div style={{ marginLeft: "auto" }}>
            <window.Btn h={30} w={null} primary style={{ padding: "0 12px", fontSize: 11 }}>
              + Шинэ захиалга
            </window.Btn>
          </div>
        </div>

        {/* saved filters */}
        <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
          <window.Chip active>Бүгд</window.Chip>
          <window.Chip>🟡 Шинэ · 12</window.Chip>
          <window.Chip>🟦 Багцлаж · 5</window.Chip>
          <window.Chip>🚚 Илгээсэн · 3</window.Chip>
          <window.Chip>+ Хадгалсан шүүлтүүр</window.Chip>
        </div>

        <div style={{ marginTop: 12, border: `1.5px solid ${C7.ink}`, borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.4fr 1fr 0.8fr 0.8fr 0.5fr",
              padding: "6px 12px",
              background: "#f4eedb",
              borderBottom: `1.2px solid ${C7.ink}`,
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <div>Дугаар</div><div>Дэлгүүр</div><div>Статус</div><div>Үнэ</div><div>Огноо</div><div></div>
          </div>
          {[
            { n: "ORD-2026-00042", st: "Хүнс-Мини", s: "🟡 Шинэ", t: "4,690₮", d: "5/11" },
            { n: "ORD-2026-00041", st: "Номин Их", s: "🟡 Шинэ", t: "12,300₮", d: "5/11" },
            { n: "ORD-2026-00040", st: "CU Tokyo", s: "🟦 Багцл.", t: "27,400₮", d: "5/10" },
            { n: "ORD-2026-00039", st: "Их Наран", s: "🟢 Хүрг.", t: "5,150₮", d: "5/09" },
            { n: "ORD-2026-00038", st: "Хүнс-Мини", s: "🟢 Хүрг.", t: "12,300₮", d: "5/08" },
          ].map((r) => (
            <div
              key={r.n}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.4fr 1fr 0.8fr 0.8fr 0.5fr",
                padding: "8px 12px",
                borderBottom: `1px dashed ${C7.ink}`,
                fontFamily: "'Patrick Hand', cursive",
                fontSize: 12,
                alignItems: "center",
              }}
            >
              <div style={{ fontFamily: "monospace", fontSize: 11 }}>{r.n}</div>
              <div>{r.st}</div>
              <div>{r.s}</div>
              <div style={{ fontWeight: 700 }}>{r.t}</div>
              <div>{r.d}</div>
              <div style={{ color: C7.indigo, textAlign: "right" }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdAdminB() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Захиалга" />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* list pane */}
        <div style={{ width: 280, borderRight: `1.5px solid ${C7.ink}`, padding: "12px 10px", overflow: "hidden" }}>
          <window.Label size={11} weight={700}>Захиалгууд · 247</window.Label>
          <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
            <window.Chip active>Шинэ</window.Chip>
            <window.Chip>Идэвхтэй</window.Chip>
            <window.Chip>Бүгд</window.Chip>
          </div>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { n: "ORD-…42", st: "Хүнс-Мини", t: "4,690₮", a: true },
              { n: "ORD-…41", st: "Номин Их", t: "12,300₮" },
              { n: "ORD-…40", st: "CU Tokyo", t: "27,400₮" },
              { n: "ORD-…39", st: "Их Наран", t: "5,150₮" },
              { n: "ORD-…38", st: "Хүнс-Мини", t: "12,300₮" },
            ].map((r) => (
              <div
                key={r.n}
                style={{
                  padding: 7,
                  borderRadius: 6,
                  border: `1.2px solid ${C7.ink}`,
                  background: r.a ? "#eef0ff" : C7.paper,
                  boxShadow: r.a ? `1.5px 2px 0 ${C7.ink}` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <window.Label size={10} weight={700} style={{ fontFamily: "monospace" }}>{r.n}</window.Label>
                  <window.Label size={10} weight={700}>{r.t}</window.Label>
                </div>
                <window.Label size={10} color={C7.muted} style={{ display: "block" }}>{r.st}</window.Label>
              </div>
            ))}
          </div>
        </div>

        {/* detail pane */}
        <div style={{ flex: 1, padding: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <window.H size={16} style={{ fontFamily: "monospace" }}>ORD-2026-00042</window.H>
            <div
              style={{
                padding: "2px 8px",
                background: "#fff4dc",
                border: `1.2px solid ${C7.ink}`,
                borderRadius: 4,
                fontFamily: "'Patrick Hand', cursive",
                fontSize: 11,
              }}
            >
              🟡 Хүлээгдэж буй
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <window.Btn h={30} w={null} style={{ padding: "0 12px", fontSize: 11 }}>Цуцлах</window.Btn>
              <window.Btn h={30} w={null} primary style={{ padding: "0 12px", fontSize: 11 }}>✓ Баталгаажуулах</window.Btn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
            {[
              { l: "Дэлгүүр", v: "Хүнс-Мини" },
              { l: "Захиалсан", v: "Б. Энхээ" },
              { l: "Утас", v: "+976 8811 2233" },
            ].map((m) => (
              <div key={m.l}>
                <window.Label size={10} color={C7.muted}>{m.l}</window.Label>
                <window.Label size={12} weight={700} style={{ display: "block" }}>{m.v}</window.Label>
              </div>
            ))}
          </div>

          <window.Label size={11} weight={700} style={{ display: "block", marginTop: 14 }}>Бараа</window.Label>
          <div style={{ marginTop: 6, border: `1.2px solid ${C7.ink}`, borderRadius: 6 }}>
            {[
              ["Soft Leaf салфетка 10ш", 2, "1,220₮", "2,440₮"],
              ["Soft Leaf салфетка 25ш", 1, "2,250₮", "2,250₮"],
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.5fr 0.7fr 0.7fr",
                  padding: "6px 10px",
                  borderBottom: i === 0 ? `1px dashed ${C7.ink}` : "none",
                  fontFamily: "'Patrick Hand', cursive",
                  fontSize: 12,
                }}
              >
                {row.map((c, j) => (
                  <div key={j} style={{ fontWeight: j === 3 ? 700 : 400 }}>{c}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <window.Label size={13} weight={700}>Нийт: 4,690₮</window.Label>
          </div>

          <window.Label size={10} color={C7.muted} style={{ display: "block", marginTop: 12 }}>📝 Тэмдэглэл</window.Label>
          <window.Label size={11} style={{ display: "block" }}>
            "Маргааш 10цаг хүртэл хүргэх боломжтой бол хүргэнэ үү"
          </window.Label>
        </div>

        <div style={{ position: "absolute", right: 6, top: 50 }}>
          <window.Note w={130} rotate={4}>
            Triage хурдан: нэг дэлгэцэнд жагсаалт + дэлгэрэнгүй
          </window.Note>
        </div>
      </div>
    </div>
  );
}

function OrdAdminC() {
  return (
    <div style={{ display: "flex", height: "100%", background: "#f4eedb" }}>
      <div style={{ flex: 1, padding: 24, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <window.Label size={11} color={C7.muted}>← Хэвийн харагдац</window.Label>
          <div style={{ marginLeft: "auto" }}>
            <window.Label size={11} color={C7.muted}>4 / 12 · хүлээгдэж буй</window.Label>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            background: "#fff",
            border: `2px solid ${C7.ink}`,
            borderRadius: 12,
            padding: 20,
            boxShadow: `2px 3px 0 ${C7.ink}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <window.H size={22} style={{ fontFamily: "monospace" }}>ORD-2026-00042</window.H>
            <window.Annot size={14} color={C7.coral}>5 мин өмнө</window.Annot>
          </div>
          <window.Label size={14} weight={700} style={{ display: "block", marginTop: 4 }}>
            Хүнс-Мини · Б. Энхээ · +976 8811 2233
          </window.Label>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <window.Box w="100%" h={70} radius={8}>
              <div style={{ padding: 8 }}>
                <window.Label size={10} color={C7.muted}>Бараа</window.Label>
                <window.Label size={22} weight={700} style={{ display: "block" }}>3</window.Label>
              </div>
            </window.Box>
            <window.Box w="100%" h={70} radius={8}>
              <div style={{ padding: 8 }}>
                <window.Label size={10} color={C7.muted}>Үнийн дүн</window.Label>
                <window.Label size={22} weight={700} style={{ display: "block" }}>4,690₮</window.Label>
              </div>
            </window.Box>
            <window.Box w="100%" h={70} radius={8} style={{ background: "#fff5b8" }}>
              <div style={{ padding: 8 }}>
                <window.Label size={10} color={C7.muted}>Тэмдэглэл</window.Label>
                <window.Label size={11} style={{ display: "block", lineHeight: 1.1, marginTop: 2 }}>
                  Маргааш 10ц хүртэл хүргэх
                </window.Label>
              </div>
            </window.Box>
          </div>

          <div style={{ marginTop: 16 }}>
            <window.Label size={11} weight={700}>Бараанууд</window.Label>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                ["Soft Leaf салфетка 10ш", "×2", "2,440₮"],
                ["Soft Leaf салфетка 25ш", "×1", "2,250₮"],
              ].map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 50px 80px",
                    padding: "6px 10px",
                    border: `1.2px solid ${C7.ink}`,
                    borderRadius: 6,
                    fontFamily: "'Patrick Hand', cursive",
                    fontSize: 13,
                  }}
                >
                  <div>{r[0]}</div>
                  <div>{r[1]}</div>
                  <div style={{ fontWeight: 700, textAlign: "right" }}>{r[2]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
            <window.Btn h={48} w={null} style={{ flex: 1, fontSize: 14 }}>✕ Цуцлах</window.Btn>
            <window.Btn h={48} w={null} primary style={{ flex: 2, fontSize: 16 }}>
              ✓ Баталгаажуулах → Дараагийн захиалга
            </window.Btn>
          </div>
        </div>

        <div style={{ position: "absolute", right: 20, bottom: 50 }}>
          <window.Note w={170} rotate={4} color="#ffd4cc">
            Warehouse / fulfillment-н хувьд: "next-next-next" хэмнэлтэй.
            Tab + Enter-ээр зайлбал хурдан.
          </window.Note>
        </div>
      </div>
    </div>
  );
}

window.OrdAdminA = OrdAdminA;
window.OrdAdminB = OrdAdminB;
window.OrdAdminC = OrdAdminC;
