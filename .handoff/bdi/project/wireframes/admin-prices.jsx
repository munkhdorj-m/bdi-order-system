/* eslint-disable react/prop-types */
/**
 * A7 — Admin price-list editor (per-supermarket overrides)
 *
 * This is the most critical admin screen — it's how BDI's actual margin gets set.
 *
 * A) Refined — same 3-column table, inline edit + autosave + clear "default vs override" hint
 * B) Reorganized — two-column diff view: products on left, only override cells on right with delta %
 * C) Exploratory — bulk operations: tier picker, %-adjustments, "copy from store X", paste from Excel
 */

const C9 = window.WF_COLORS;

function PricesA() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Үнэ" />
      <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
        <window.Label size={11} color={C9.muted}>← Дэлгүүрүүд</window.Label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <window.H size={20}>Хүнс-Мини</window.H>
          <window.Label size={11} color={C9.muted}>· 14 SKU дээр өөрчилсөн / 56 SKU</window.Label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <window.Btn h={28} w={null} style={{ padding: "0 10px", fontSize: 11 }}>📂 Excel импорт</window.Btn>
            <window.Annot size={11} color={C9.indigo}>● Автомат хадгалагдаж байна</window.Annot>
          </div>
        </div>

        <div style={{ marginTop: 12, border: `1.5px solid ${C9.ink}`, borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              padding: "6px 12px",
              background: "#f4eedb",
              borderBottom: `1.2px solid ${C9.ink}`,
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <div>Бараа</div><div>Жишиг үнэ</div><div>Энэ дэлгүүрийн үнэ</div>
          </div>
          {[
            { n: "Soft Leaf салфетка 10ш", base: "1,220₮", own: "1,180", overrid: true },
            { n: "Soft Leaf салфетка 25ш", base: "2,250₮", own: "", overrid: false },
            { n: "Хөвөн дэвсгэр 50ш", base: "2,150₮", own: "2,050", overrid: true },
            { n: "Угаалгын нунтаг 1кг", base: "8,400₮", own: "", overrid: false },
            { n: "Ариутгал 500мл", base: "5,650₮", own: "5,400", overrid: true },
            { n: "Шингэн саван 750мл", base: "3,900₮", own: "", overrid: false },
          ].map((p, i, arr) => (
            <div
              key={p.n}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                padding: "8px 12px",
                borderBottom: i < arr.length - 1 ? `1px dashed ${C9.ink}` : "none",
                fontFamily: "'Patrick Hand', cursive",
                fontSize: 12,
                alignItems: "center",
              }}
            >
              <div>{p.n}</div>
              <div style={{ color: C9.muted }}>{p.base}</div>
              <div>
                <div
                  style={{
                    width: 110,
                    height: 28,
                    border: `1.5px solid ${p.overrid ? C9.indigo : C9.ink}`,
                    borderRadius: 6,
                    padding: "0 8px",
                    display: "flex",
                    alignItems: "center",
                    background: p.overrid ? "#eef0ff" : "#fff",
                    fontFamily: "'Kalam', cursive",
                    fontWeight: 700,
                    fontSize: 13,
                    color: p.own ? C9.ink : C9.muted,
                  }}
                >
                  {p.own ? `${p.own}₮` : "default"}
                </div>
                {p.overrid && (
                  <window.Annot size={10} color={C9.indigo} style={{ marginLeft: 4 }}>
                    ✎ override
                  </window.Annot>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", right: 14, top: 80 }}>
          <window.Note w={150} rotate={5}>
            Хоосон = default. Бичсэн = override. Autosave-аар "Хадгалах" товч хэрэггүй.
          </window.Note>
        </div>
      </div>
    </div>
  );
}

function PricesB() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Үнэ" />
      <div style={{ flex: 1, padding: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <window.H size={18}>Хүнс-Мини</window.H>
          <window.Label size={11} color={C9.muted}>үнийн жагсаалт</window.Label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <window.Chip active>Зөвхөн өөрчилсөн</window.Chip>
            <window.Chip>Бүгд</window.Chip>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12, height: 360 }}>
          {/* products column */}
          <div style={{ flex: 1.4, border: `1.5px solid ${C9.ink}`, borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                padding: "6px 10px",
                background: "#f4eedb",
                borderBottom: `1.2px solid ${C9.ink}`,
                fontFamily: "'Patrick Hand', cursive",
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              Бараа
            </div>
            {[
              "Soft Leaf салфетка 10ш",
              "Soft Leaf салфетка 25ш",
              "Хөвөн дэвсгэр 50ш",
              "Ариутгал 500мл",
              "Шингэн саван 750мл",
            ].map((n, i) => (
              <div
                key={n}
                style={{
                  padding: "8px 10px",
                  borderBottom: `1px dashed ${C9.ink}`,
                  background: i === 0 ? "#eef0ff" : "transparent",
                  fontFamily: "'Patrick Hand', cursive",
                  fontSize: 12,
                }}
              >
                {n}
              </div>
            ))}
          </div>

          {/* diff column */}
          <div style={{ flex: 1, border: `1.5px solid ${C9.ink}`, borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                padding: "6px 10px",
                background: "#f4eedb",
                borderBottom: `1.2px solid ${C9.ink}`,
                fontFamily: "'Patrick Hand', cursive",
                fontWeight: 700,
                fontSize: 11,
                display: "flex",
              }}
            >
              <span>Үнэ</span>
              <span style={{ marginLeft: "auto", color: C9.muted }}>Δ</span>
            </div>
            {[
              { base: "1,220₮", own: "1,180₮", diff: "−3.3%", neg: true },
              { base: "2,250₮", own: null, diff: "default" },
              { base: "2,150₮", own: "2,050₮", diff: "−4.7%", neg: true },
              { base: "5,650₮", own: "5,400₮", diff: "−4.4%", neg: true },
              { base: "3,900₮", own: null, diff: "default" },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 10px",
                  borderBottom: `1px dashed ${C9.ink}`,
                  fontFamily: "'Patrick Hand', cursive",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: i === 0 ? "#eef0ff" : "transparent",
                }}
              >
                {p.own ? (
                  <>
                    <span style={{ textDecoration: "line-through", color: C9.muted, fontSize: 10 }}>{p.base}</span>
                    <span style={{ fontWeight: 700 }}>{p.own}</span>
                  </>
                ) : (
                  <span style={{ color: C9.muted, fontStyle: "italic" }}>{p.base} (default)</span>
                )}
                <span
                  style={{
                    marginLeft: "auto",
                    color: p.neg ? "#3a9a5e" : C9.muted,
                    fontWeight: 700,
                  }}
                >
                  {p.diff}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: "#fdfaef", border: `1.2px solid ${C9.ink}`, borderRadius: 6 }}>
          <window.Label size={11} weight={700}>Хүнс-Мини-ийн дундаж хямдрал:</window.Label>{" "}
          <window.Annot size={12} color="#3a9a5e">−4.1%</window.Annot>{" "}
          <window.Label size={11} color={C9.muted}>· 14/56 бараан дээр идэвхтэй</window.Label>
        </div>

        <div style={{ position: "absolute", right: 14, top: 70 }}>
          <window.Note w={150} rotate={4}>
            Diff harach: "default-аас хэр зөрөв" гэдэг шууд харагдана
          </window.Note>
        </div>
      </div>
    </div>
  );
}

function PricesC() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <window.AdminSidebar active="Үнэ" />
      <div style={{ flex: 1, padding: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <window.H size={18}>Хүнс-Мини</window.H>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <window.Btn h={28} w={null} primary style={{ padding: "0 10px", fontSize: 11 }}>
              💾 Хадгалах
            </window.Btn>
          </div>
        </div>

        {/* bulk action bar */}
        <div
          style={{
            marginTop: 10,
            background: "#fff4dc",
            border: `1.5px solid ${C9.ink}`,
            borderRadius: 8,
            padding: 10,
            boxShadow: `1.5px 2px 0 ${C9.ink}`,
          }}
        >
          <window.Label size={11} weight={700}>⚡ Бөөнөөр өөрчлөх</window.Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
            <window.Chip>Бүгд</window.Chip>
            <window.Chip active>Сонгосон · 6</window.Chip>
            <span style={{ width: 1, height: 18, background: C9.ink, opacity: 0.3 }} />
            <window.Chip>−5%</window.Chip>
            <window.Chip>−10%</window.Chip>
            <window.Chip>+ Заасан хувь</window.Chip>
            <span style={{ width: 1, height: 18, background: C9.ink, opacity: 0.3 }} />
            <window.Chip>📋 Дэлгүүрээс хуулах…</window.Chip>
            <window.Chip>📊 Tier болгох</window.Chip>
            <window.Chip>↺ Default рүү</window.Chip>
          </div>
        </div>

        {/* table */}
        <div style={{ marginTop: 10, border: `1.5px solid ${C9.ink}`, borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "30px 1.8fr 0.8fr 0.8fr 0.7fr",
              padding: "6px 10px",
              background: "#f4eedb",
              borderBottom: `1.2px solid ${C9.ink}`,
              fontFamily: "'Patrick Hand', cursive",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <div>☐</div><div>Бараа</div><div>Жишиг</div><div>Энэ дэлгүүр</div><div>Δ</div>
          </div>
          {[
            { n: "Soft Leaf салфетка 10ш", b: "1,220", o: "1,159", d: "−5%", sel: true, paste: false },
            { n: "Soft Leaf салфетка 25ш", b: "2,250", o: "2,138", d: "−5%", sel: true },
            { n: "Хөвөн дэвсгэр 50ш", b: "2,150", o: "2,043", d: "−5%", sel: true, paste: true },
            { n: "Угаалгын нунтаг 1кг", b: "8,400", o: "", d: "—", sel: false },
            { n: "Ариутгал 500мл", b: "5,650", o: "5,368", d: "−5%", sel: true },
            { n: "Шингэн саван 750мл", b: "3,900", o: "3,705", d: "−5%", sel: true },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1.8fr 0.8fr 0.8fr 0.7fr",
                padding: "6px 10px",
                borderBottom: `1px dashed ${C9.ink}`,
                fontFamily: "'Patrick Hand', cursive",
                fontSize: 12,
                alignItems: "center",
                background: r.sel ? "#eef0ff" : "transparent",
              }}
            >
              <div style={{ fontFamily: "'Kalam', cursive" }}>{r.sel ? "☑" : "☐"}</div>
              <div>{r.n}</div>
              <div style={{ color: C9.muted }}>{r.b}</div>
              <div
                style={{
                  fontWeight: 700,
                  position: "relative",
                  background: r.paste ? "#fff5b8" : "transparent",
                  padding: r.paste ? "2px 4px" : 0,
                  borderRadius: 4,
                }}
              >
                {r.o ? `${r.o}₮` : <span style={{ color: C9.muted, fontStyle: "italic" }}>default</span>}
                {r.paste && (
                  <window.Annot size={9} color={C9.coral} style={{ marginLeft: 4 }}>📋 paste</window.Annot>
                )}
              </div>
              <div style={{ color: r.o ? "#3a9a5e" : C9.muted, fontWeight: 700 }}>{r.d}</div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", right: 14, top: 70 }}>
          <window.Note w={170} rotate={4} color="#ffd4cc">
            Real workflow: BDI 50 SKU × 20 store. Bulk + paste-from-Excel хэрэгтэй.
          </window.Note>
        </div>
      </div>
    </div>
  );
}

window.PricesA = PricesA;
window.PricesB = PricesB;
window.PricesC = PricesC;
