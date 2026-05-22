/* eslint-disable react/prop-types */
/**
 * B3 — Product detail
 *
 * A) Refined — sticky add-to-cart bar, bigger image, clearer per-unit/per-box price
 * B) Reorganized — tabs (Мэдээлэл / Захиалгын түүх / Холбоотой)
 *    Order history of THIS sku for THIS store is huge value in B2B
 * C) Exploratory — "case vs unit" toggle + mini reorder pattern chart
 */

const C3 = window.WF_COLORS;

function ProductA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 10px 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <window.Label size={16}>←</window.Label>
        <window.Label size={12} weight={700}>Бүтээгдэхүүн</window.Label>
      </div>
      <div style={{ padding: 10 }}>
        <window.ImgBox w="100%" h={170} radius={10} label="product photo" />
      </div>
      <div style={{ padding: "0 14px" }}>
        <window.Label size={9} color={C3.indigo} style={{ textTransform: "uppercase", letterSpacing: 1 }}>
          Soft Leaf
        </window.Label>
        <window.H size={15} style={{ marginTop: 3 }}>
          Soft Leaf 99.9% ариутгалын нойтон салфетка 10ш
        </window.H>
        <window.Label size={10} color={C3.muted} style={{ display: "block", marginTop: 4 }}>
          SKU: 4890326012629
        </window.Label>

        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 6 }}>
          <window.Label size={20} weight={700}>1,220₮</window.Label>
          <window.Label size={11} color={C3.muted}>/уут · Хайрцагт 120ш</window.Label>
        </div>
        <div style={{ marginTop: 4 }}>
          <window.Annot size={11} color={C3.indigo}>● Үлдэгдэл: 48</window.Annot>
        </div>

        <div style={{ marginTop: 14 }}>
          <window.Label size={11} weight={700}>Тайлбар</window.Label>
          <div style={{ marginTop: 6 }}>
            <window.Stack lines={4} w="95%" />
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", right: -120, top: 220 }}>
        <window.Note w={150} rotate={3}>
          Sticky bottom bar = scroll-аар алдрахгүй
        </window.Note>
      </div>

      <div style={{ marginTop: "auto", borderTop: `1.5px solid ${C3.ink}`, background: "#fdfaef", padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: `1.5px solid ${C3.ink}`,
              borderRadius: 18,
              fontFamily: "'Kalam', cursive",
              fontWeight: 700,
            }}
          >
            <span style={{ padding: "5px 11px" }}>−</span>
            <span style={{ padding: "5px 8px", minWidth: 24, textAlign: "center" }}>1</span>
            <span style={{ padding: "5px 11px" }}>+</span>
          </div>
          <div style={{ flex: 1 }}>
            <window.Btn primary h={40}>🛒 Сагсанд нэмэх · 1,220₮</window.Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductB() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 10px 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <window.Label size={16}>←</window.Label>
        <window.Label size={11} weight={700}>Soft Leaf салфетка 10ш</window.Label>
      </div>
      <div style={{ padding: "4px 10px", display: "flex", gap: 8 }}>
        <window.ImgBox w={100} h={100} radius={8} />
        <div style={{ flex: 1 }}>
          <window.Label size={9} color={C3.indigo}>SOFT LEAF</window.Label>
          <window.Label size={12} weight={700} style={{ display: "block", lineHeight: 1.1 }}>
            Салфетка 10ш
          </window.Label>
          <window.Label size={16} weight={700} style={{ display: "block", marginTop: 6 }}>
            1,220₮
          </window.Label>
          <window.Label size={10} color={C3.muted}>уут / Хайрцагт 120</window.Label>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", borderBottom: `1.2px solid ${C3.ink}`, marginTop: 6 }}>
        {["Мэдээлэл", "Захиалга", "Холбоотой"].map((t, i) => (
          <div
            key={t}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 0",
              borderBottom: i === 1 ? `2.5px solid ${C3.indigo}` : "none",
              fontFamily: "'Kalam', cursive",
              fontSize: 12,
              fontWeight: 700,
              color: i === 1 ? C3.indigo : C3.muted,
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* tab content: order history */}
      <div style={{ padding: "10px 12px", flex: 1, overflow: "hidden" }}>
        <window.Label size={10} color={C3.muted}>Хүнс-Мини дээрх таны түүх</window.Label>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { d: "5/11", q: 2, p: "2,440₮" },
            { d: "5/02", q: 4, p: "4,880₮" },
            { d: "4/24", q: 2, p: "2,440₮" },
            { d: "4/15", q: 3, p: "3,660₮" },
          ].map((r) => (
            <div
              key={r.d}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 7px",
                border: `1px solid ${C3.ink}`,
                borderRadius: 6,
              }}
            >
              <window.Label size={11} weight={700} style={{ width: 38 }}>{r.d}</window.Label>
              <window.Label size={11}>×{r.q}</window.Label>
              <window.Label size={11} color={C3.muted} style={{ marginLeft: "auto" }}>{r.p}</window.Label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <window.Annot size={11} color={C3.indigo}>📈 Сард ~10ш авдаг</window.Annot>
        </div>
      </div>

      <div style={{ position: "absolute", left: -120, top: 220 }}>
        <window.Note w={150} rotate={-4}>
          B2B-д ХЭДЭН удаа авсан = price-ээс илүү үнэлэгддэг
        </window.Note>
      </div>

      <div style={{ borderTop: `1.5px solid ${C3.ink}`, padding: 10, background: "#fdfaef" }}>
        <window.Btn primary h={40}>Сагсанд +1</window.Btn>
      </div>
    </div>
  );
}

function ProductC() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ padding: "18px 10px 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <window.Label size={16}>←</window.Label>
        <window.Label size={12} weight={700}>Бүтээгдэхүүн</window.Label>
      </div>
      <div style={{ padding: 10 }}>
        <window.ImgBox w="100%" h={130} radius={10} label="product photo" />
      </div>
      <div style={{ padding: "0 12px" }}>
        <window.Label size={9} color={C3.indigo} style={{ textTransform: "uppercase" }}>Soft Leaf</window.Label>
        <window.H size={14} style={{ marginTop: 2 }}>Салфетка 10ш</window.H>

        {/* unit/case toggle */}
        <div style={{ marginTop: 10, display: "flex", border: `1.5px solid ${C3.ink}`, borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{
              flex: 1,
              padding: 8,
              background: C3.indigo,
              color: "#fff",
              textAlign: "center",
              fontFamily: "'Kalam', cursive",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Уут · 1,220₮
          </div>
          <div
            style={{
              flex: 1,
              padding: 8,
              textAlign: "center",
              fontFamily: "'Kalam', cursive",
              fontWeight: 700,
              fontSize: 12,
              borderLeft: `1.5px solid ${C3.ink}`,
            }}
          >
            Хайрцаг<br />
            <window.Label size={9} color={C3.muted}>120ш · 138,000₮</window.Label>
          </div>
        </div>

        {/* mini chart */}
        <div style={{ marginTop: 14 }}>
          <window.Label size={11} weight={700}>Таны захиалгын түүх</window.Label>
          <div style={{ marginTop: 6, display: "flex", alignItems: "flex-end", gap: 3, height: 50 }}>
            {[14, 28, 18, 22, 10, 32, 24].map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: "100%",
                    height: h,
                    background: i === 5 ? C3.indigo : C3.ink,
                    opacity: i === 5 ? 1 : 0.4,
                    borderRadius: "2px 2px 0 0",
                    border: `1px solid ${C3.ink}`,
                  }}
                />
                <window.Label size={8} color={C3.muted}>{`M${i + 1}`}</window.Label>
              </div>
            ))}
          </div>
          <window.Annot size={10} color={C3.indigo} style={{ display: "block", marginTop: 4 }}>
            ↪ Хамгийн сүүлд: 5/11 · 2 уут
          </window.Annot>
        </div>

        <div style={{ marginTop: 14 }}>
          <window.Box w="100%" h={50} radius={8} style={{ background: "#fff5cc", padding: 8 }}>
            <window.Label size={11} weight={700}>💡 Санал болгож байна</window.Label>
            <window.Label size={10} color={C3.muted} style={{ display: "block" }}>
              Та сард ~10 уут авдаг. Энэ удаа 12 авах уу?
            </window.Label>
          </window.Box>
        </div>
      </div>

      <div style={{ position: "absolute", right: -130, top: 260 }}>
        <window.Note w={160} rotate={5} color="#ffd4cc">
          Pattern chart + санал = "automated re-stock" эхлэл
        </window.Note>
      </div>

      <div style={{ marginTop: "auto", borderTop: `1.5px solid ${C3.ink}`, padding: 10, background: "#fdfaef" }}>
        <window.Btn primary h={40}>+12 уут сагсанд (14,640₮)</window.Btn>
      </div>
    </div>
  );
}

window.ProductA = ProductA;
window.ProductB = ProductB;
window.ProductC = ProductC;
