/* eslint-disable react/prop-types */
/**
 * A5 — Admin products
 *
 * A) Refined — same table, inline qty + price edit, stock alert highlights
 * B) Reorganized — card-grid with image-first thumbnails, low-stock badge
 * C) Exploratory — spreadsheet-style bulk editor (Excel-like) + drag-drop image upload column
 */

const C8 = window.WF_COLORS;

function ProductsA() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Бараа" />
      <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <window.H size={18}>Бараа</window.H>
          <window.Label size={11} color={C8.muted}>56 SKU</window.Label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <window.Btn h={28} w={null} style={{ padding: "0 10px", fontSize: 11 }}>📂 Excel</window.Btn>
            <window.Btn h={28} w={null} primary style={{ padding: "0 10px", fontSize: 11 }}>+ Шинэ</window.Btn>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <div
            style={{
              flex: 1,
              border: `1.2px solid ${C8.ink}`,
              borderRadius: 999,
              padding: "5px 12px",
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 11,
              color: C8.muted,
              background: "#fff",
            }}
          >
            🔍 Хайх (нэр, SKU, бренд)…
          </div>
          <window.Chip>Ангилал ⌄</window.Chip>
          <window.Chip>Бренд ⌄</window.Chip>
          <window.Chip active>Үлдэгдэл ↓</window.Chip>
        </div>

        <div style={{ marginTop: 10, border: `1.5px solid ${C8.ink}`, borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1.6fr 1fr 1fr 0.6fr 0.6fr 0.4fr",
              padding: "6px 10px",
              background: "#f4eedb",
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 11,
              fontWeight: 700,
              borderBottom: `1.2px solid ${C8.ink}`,
            }}
          >
            <div></div><div>Нэр</div><div>Бренд</div><div>SKU</div><div>Үнэ</div><div>Үлдэгдэл</div><div></div>
          </div>
          {[
            { n: "Soft Leaf салфетка 10ш", b: "Soft Leaf", sku: "4890326012629", p: "1,220₮", q: 48 },
            { n: "Soft Leaf салфетка 25ш тагтай", b: "Soft Leaf", sku: "4891…", p: "2,250₮", q: 22 },
            { n: "Хөвөн дэвсгэр 50ш", b: "Cleanly", sku: "6900…", p: "2,150₮", q: 6, low: true },
            { n: "Угаалгын нунтаг 1кг", b: "Persil", sku: "4015…", p: "8,400₮", q: 0, out: true },
            { n: "Ариутгалын шингэн 500мл", b: "Dettol", sku: "8901…", p: "5,650₮", q: 14 },
          ].map((p) => (
            <div
              key={p.sku}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1.6fr 1fr 1fr 0.6fr 0.6fr 0.4fr",
                padding: "7px 10px",
                borderBottom: `1px dashed ${C8.ink}`,
                fontFamily: "'Patrick Hand', cursive",
                fontSize: 12,
                alignItems: "center",
                background: p.out ? "#ffe9e2" : p.low ? "#fff4dc" : "transparent",
              }}
            >
              <window.ImgBox w={24} h={24} radius={4} />
              <div>{p.n}</div>
              <div style={{ color: C8.indigo }}>{p.b}</div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: C8.muted }}>{p.sku}</div>
              <div style={{ fontWeight: 700 }}>{p.p}</div>
              <div style={{ fontWeight: 700, color: p.out ? C8.coral : p.low ? "#a8771a" : C8.ink }}>
                {p.q}
                {p.out && " ⚠"}
                {p.low && !p.out && " ▼"}
              </div>
              <div style={{ color: C8.indigo, textAlign: "right" }}>✎</div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", right: 14, top: 60 }}>
          <window.Note w={140} rotate={5}>
            Row tint = stock alert. ⚠ дуусаагүй, ▼ цөөн.
          </window.Note>
        </div>
      </div>
    </div>
  );
}

function ProductsB() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Бараа" />
      <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <window.H size={18}>Бараа</window.H>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <window.Chip>☰ Жагсаалт</window.Chip>
            <window.Chip active>▦ Сүлжээ</window.Chip>
          </div>
        </div>

        {/* category sidenav */}
        <div style={{ display: "flex", gap: 12, marginTop: 10, height: 380 }}>
          <div style={{ width: 130, borderRight: `1px dashed ${C8.ink}`, paddingRight: 8 }}>
            <window.Label size={10} color={C8.muted}>Ангилал</window.Label>
            {["Бүгд · 56", "Цаас · 18", "Хөвөн · 12", "Угаалга · 14", "Ариутгал · 6", "Бусад · 6"].map((c, i) => (
              <div
                key={c}
                style={{
                  padding: "4px 6px",
                  borderRadius: 4,
                  background: i === 0 ? C8.indigo : "transparent",
                  color: i === 0 ? "#fff" : C8.ink,
                  fontFamily: "'Patrick Hand', cursive",
                  fontSize: 11,
                  marginTop: 3,
                }}
              >
                {c}
              </div>
            ))}
            <window.Btn h={28} w="100%" style={{ marginTop: 8, fontSize: 11 }}>+ Ангилал</window.Btn>
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {[
                { n: "Soft Leaf 10ш", p: "1,220₮", q: 48 },
                { n: "Soft Leaf 25ш", p: "2,250₮", q: 22 },
                { n: "Хөвөн дэвсгэр 50ш", p: "2,150₮", q: 6, low: true },
                { n: "Угаалгын нунтаг 1кг", p: "8,400₮", q: 0, out: true },
                { n: "Ариутгал 500мл", p: "5,650₮", q: 14 },
                { n: "Шингэн саван 750мл", p: "3,900₮", q: 28 },
                { n: "Хөвөн савх 200ш", p: "1,850₮", q: 33 },
                { n: "Шүлс 250мл", p: "4,150₮", q: 12 },
              ].map((p) => (
                <div
                  key={p.n}
                  style={{
                    border: `1.2px solid ${C8.ink}`,
                    borderRadius: 8,
                    padding: 6,
                    background: C8.paper,
                    position: "relative",
                  }}
                >
                  <window.ImgBox w="100%" h={60} radius={4} />
                  {p.out && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        background: C8.coral,
                        color: "#fff",
                        fontFamily: "'Patrick Hand', cursive",
                        fontSize: 9,
                        padding: "1px 4px",
                        borderRadius: 3,
                      }}
                    >
                      ДУУССАН
                    </div>
                  )}
                  {p.low && !p.out && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        background: "#e8a13a",
                        color: "#fff",
                        fontFamily: "'Patrick Hand', cursive",
                        fontSize: 9,
                        padding: "1px 4px",
                        borderRadius: 3,
                      }}
                    >
                      ЦӨӨН
                    </div>
                  )}
                  <window.Label size={10} weight={700} style={{ display: "block", marginTop: 4, lineHeight: 1.1 }}>
                    {p.n}
                  </window.Label>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                    <window.Label size={10} weight={700}>{p.p}</window.Label>
                    <window.Label size={10} color={p.out ? C8.coral : p.low ? "#a8771a" : C8.muted}>
                      Үлд: {p.q}
                    </window.Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", right: 14, top: 60 }}>
          <window.Note w={140} rotate={4}>
            Зургийн анхаарлыг өндөр болгож, нөөцийн badge front-and-center
          </window.Note>
        </div>
      </div>
    </div>
  );
}

function ProductsC() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Бараа" />
      <div style={{ flex: 1, padding: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <window.H size={18}>Бараа · Bulk editor</window.H>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <window.Chip>Undo ↶</window.Chip>
            <window.Chip>Redo ↷</window.Chip>
            <window.Btn h={28} w={null} primary style={{ padding: "0 12px", fontSize: 11 }}>
              💾 Хадгалах (3 өөрчлөлт)
            </window.Btn>
          </div>
        </div>

        {/* spreadsheet */}
        <div
          style={{
            marginTop: 10,
            border: `1.8px solid ${C8.ink}`,
            borderRadius: 4,
            overflow: "hidden",
            background: "#fff",
            boxShadow: `2px 2px 0 ${C8.ink}`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 2fr 1fr 0.8fr 0.7fr 0.7fr 0.7fr",
              background: "#e8e2cf",
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 11,
              fontWeight: 700,
              borderBottom: `1.5px solid ${C8.ink}`,
            }}
          >
            {["", "Нэр", "Бренд", "SKU", "Үнэ", "Үлд.", "Зураг"].map((h, i) => (
              <div key={i} style={{ padding: "4px 8px", borderRight: i < 6 ? `1px solid ${C8.ink}` : "none" }}>
                {h}
              </div>
            ))}
          </div>
          {[
            { n: "Soft Leaf салфетка 10ш", b: "Soft Leaf", sku: "4890326012629", p: "1,220", q: "48", edit: false },
            { n: "Soft Leaf салфетка 25ш", b: "Soft Leaf", sku: "4891…", p: "2,250", q: "22", edit: "p" },
            { n: "Хөвөн дэвсгэр 50ш", b: "Cleanly", sku: "6900…", p: "2,150", q: "6", edit: "q" },
            { n: "Угаалгын нунтаг 1кг", b: "Persil", sku: "4015…", p: "8,400", q: "0", edit: false, img: true },
            { n: "Ариутгал 500мл", b: "Dettol", sku: "8901…", p: "5,650", q: "14", edit: "n" },
            { n: "Шингэн саван 750мл", b: "Lavera", sku: "7702…", p: "3,900", q: "28", edit: false },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 2fr 1fr 0.8fr 0.7fr 0.7fr 0.7fr",
                borderBottom: `1px solid ${C8.ink}`,
                fontFamily: "'Patrick Hand', cursive",
                fontSize: 11,
                background: "#fff",
              }}
            >
              <div style={{ padding: "4px 6px", borderRight: `1px solid ${C8.ink}`, background: "#e8e2cf", color: C8.muted, textAlign: "center" }}>{i + 1}</div>
              <Cell value={r.n} edit={r.edit === "n"} />
              <Cell value={r.b} />
              <Cell value={r.sku} mono />
              <Cell value={r.p} edit={r.edit === "p"} bold />
              <Cell value={r.q} edit={r.edit === "q"} alert={r.q === "0"} />
              <Cell value={r.img ? "[drop]" : "✓"} drop={r.img} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <window.Label size={11} color={C8.muted}>↑↓ ← → шилжих · Enter засах · Ctrl+C/V хуулах</window.Label>
        </div>

        <div style={{ position: "absolute", right: 14, top: 60 }}>
          <window.Note w={150} rotate={4} color="#ffd4cc">
            Excel-ээс дассан админд танил. 50 SKU засахад 50 modal биш.
          </window.Note>
        </div>
      </div>
    </div>
  );
}

function Cell({ value, edit, bold, mono, alert, drop }) {
  return (
    <div
      style={{
        padding: "4px 8px",
        borderRight: `1px solid ${C8.ink}`,
        fontWeight: bold ? 700 : 400,
        background: edit ? "#fffbe0" : drop ? "#eef0ff" : "transparent",
        outline: edit ? `1.5px solid ${C8.indigo}` : "none",
        outlineOffset: -2,
        fontFamily: mono ? "monospace" : "'Patrick Hand', cursive",
        fontSize: mono ? 10 : 11,
        color: alert ? C8.coral : C8.ink,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        position: "relative",
      }}
    >
      {drop && (
        <span style={{ color: C8.indigo, fontStyle: "italic", fontSize: 10 }}>📤 drop image</span>
      )}
      {!drop && value}
      {edit && (
        <span
          style={{
            position: "absolute",
            right: 4,
            top: 4,
            color: C8.indigo,
            fontSize: 9,
            fontFamily: "'Kalam', cursive",
          }}
        >
          ✎
        </span>
      )}
    </div>
  );
}

window.ProductsA = ProductsA;
window.ProductsB = ProductsB;
window.ProductsC = ProductsC;
