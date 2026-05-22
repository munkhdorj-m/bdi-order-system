/* eslint-disable react/prop-types */
/**
 * B1 — Login / OTP / onboarding
 *
 * A) Refined — same shape, tighter type ramp, 16px input to skip iOS zoom
 * B) Reorganized — single screen: phone + OTP inline, no flicker between steps
 * C) Exploratory — role-aware entry: "Buyer / Rep / Admin" tiles + Viber/SMS choice
 *    (common in MN; SMS isn't always reliable)
 */

const C = window.WF_COLORS;

/* ---------- variant A: refined ---------- */
function LoginA() {
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ marginTop: 18, textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            border: `2px solid ${C.ink}`,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: C.indigo,
            color: "#fff",
            fontFamily: "'Kalam', cursive",
            fontWeight: 700,
            fontSize: 22,
            boxShadow: `1.5px 2px 0 ${C.ink}`
          }}>
          
          BDI
        </div>
        <window.H size={20} style={{ marginTop: 14 }}>Тавтай морил</window.H>
        <window.Label size={13} color={C.muted}>Захиалгын систем · нэвтрэх</window.Label>
      </div>

      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
        <window.Label size={12}>Утасны дугаар</window.Label>
        <window.Box w="100%" h={44} radius={10} shadow>
          <div style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
            <window.Label size={14} color={C.muted}>+976</window.Label>
            <div style={{ width: 1, height: 18, background: C.ink, opacity: 0.3 }} />
            <window.Label size={14}>8811 ____</window.Label>
          </div>
        </window.Box>
        <div style={{ marginTop: 10 }}>
          <window.Btn primary h={44}>Код илгээх →</window.Btn>
        </div>
      </div>

      <div style={{ marginTop: "auto", textAlign: "center" }}>
        <window.Label size={11} color={C.muted}>
          Шинэ хэрэглэгч үү? <span style={{ color: C.indigo, textDecoration: "underline" }}>Бүртгүүлэх</span>
        </window.Label>
      </div>
    </div>);

}

/* ---------- variant B: inline reorganized ---------- */
function LoginB() {
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ marginTop: 22 }}>
        <window.H size={22}>Нэвтрэх</window.H>
        <window.Label size={12} color={C.muted}>Утасны дугаараар</window.Label>
      </div>

      {/* Combined phone + OTP, no screen change */}
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <window.Box w="100%" h={44} radius={10}>
          <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <window.Label size={14}>+976 8811 2233</window.Label>
            <div style={{ marginLeft: "auto" }}>
              <window.Annot size={11} color={C.indigo}>✓ илгээгдсэн</window.Annot>
            </div>
          </div>
        </window.Box>

        <window.Label size={12} style={{ marginTop: 8 }}>4 оронтой код</window.Label>
        <div style={{ display: "flex", gap: 8 }}>
          {[2, 4, 1, ""].map((d, i) =>
          <window.Box key={i} w={52} h={56} radius={10} shadow={i < 3}>
              <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Kalam', cursive",
                fontSize: 24,
                fontWeight: 700,
                color: i < 3 ? C.ink : C.muted
              }}>
              
                {d || "_"}
              </div>
            </window.Box>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <window.Label size={11} color={C.muted}>0:42 дотор кодыг оруулна уу</window.Label>
          <window.Label size={11} color={C.indigo}>Дахин илгээх</window.Label>
        </div>
      </div>

      <div style={{ position: "absolute", right: -90, top: 220 }}>
        <window.Note w={170} rotate={6}>
          Нэг дэлгэц = бага зөрөлд. Дугаар, код хоёулаа энд.
        </window.Note>
      </div>

      <div style={{ marginTop: "auto" }}>
        <window.Btn primary h={44}>Үргэлжлүүлэх</window.Btn>
      </div>
    </div>);

}

/* ---------- variant C: exploratory ---------- */
function LoginC() {
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", height: "100%" }}>
      <window.PhoneStatus />
      <div style={{ marginTop: 18, textAlign: "center" }}>
        <window.H size={20}>Та хэн бэ?</window.H>
        <window.Label size={12} color={C.muted}>Эхлэхийн тулд үүргээ сонгоно уу</window.Label>
      </div>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        {[
        { t: "Дэлгүүрийн менежер", s: "Захиалга өгөх", a: true },
        { t: "Борлуулалтын төлөөлөгч", s: "Дэлгүүрийн нэрийн өмнөөс" },
        { t: "BDI ажилтан", s: "Админ хэсэг" }].
        map((r, i) =>
        <window.Box key={i} w="100%" h={64} radius={12} shadow={r.a} style={{ background: r.a ? "#eef0ff" : C.paper }}>
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, height: "100%" }}>
              <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1.5px solid ${C.ink}`,
                background: r.a ? C.indigo : C.paper,
                color: r.a ? "#fff" : C.ink,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Kalam', cursive",
                fontWeight: 700
              }}>
              
                {["🛒", "👤", "⚙"][i]}
              </div>
              <div style={{ flex: 1 }}>
                <window.H size={14}>{r.t}</window.H>
                <window.Label size={11} color={C.muted}>{r.s}</window.Label>
              </div>
              <window.Label size={18} color={r.a ? C.indigo : C.muted}>›</window.Label>
            </div>
          </window.Box>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <window.Label size={11} color={C.muted} style={{ display: "block", marginBottom: 6 }}>
          Кодыг хаашаа илгээх вэ?
        </window.Label>
        <div style={{ display: "flex", gap: 6 }}>
          <window.Chip active>SMS</window.Chip>
          <window.Chip>Viber</window.Chip>
          <window.Chip>Дуудлага</window.Chip>
        </div>
      </div>

      <div style={{ position: "absolute", left: -120, top: 320 }}>
        <window.Note w={150} rotate={-4} color="#ffd4cc">
          MN-д SMS заримдаа саатдаг. Viber fallback нэмж үзвэл?
        </window.Note>
      </div>
    </div>);

}

/* ---------- Desktop login (same auth, wider canvas) ---------- */
function LoginDesktop() {
  return (
    <div style={{ display: "flex", height: "100%", background: C.paper }}>
      <div
        style={{
          flex: 1.1,
          background: C.indigo,
          color: "#fff",
          padding: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
        
        <div>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 12,
              border: `2px solid #fff`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Kalam', cursive",
              fontWeight: 700,
              fontSize: 22
            }}>
            
            BDI
          </div>
          <div style={{ marginTop: 30, fontFamily: "'Kalam', cursive", fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
            Захиалга илгээх<br />хамгийн хялбар арга
          </div>
          <div style={{ marginTop: 12, fontFamily: "'Patrick Hand', cursive", fontSize: 14, opacity: 0.85 }}>
            B2B бөөний захиалгын систем · BDI
          </div>
        </div>
        <window.Label size={11} color="#ffffff" style={{ opacity: 0.7 }}>
          © 2026 BDI
        </window.Label>
      </div>
      <div style={{ flex: 1, padding: 40, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <window.H size={24}>Нэвтрэх</window.H>
        <window.Label size={13} color={C.muted}>Утасны дугаараар</window.Label>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
          <window.Label size={12}>Утас</window.Label>
          <window.Box w="100%" h={42} radius={8} shadow>
            <div style={{ padding: "9px 12px" }}>
              <window.Label size={14}>+976 8811 ____</window.Label>
            </div>
          </window.Box>
          <div style={{ marginTop: 8 }}>
            <window.Btn primary h={42} w={320}>Код илгээх</window.Btn>
          </div>
          <window.Label size={11} color={C.muted} style={{ marginTop: 6 }}>
            Бүртгэлгүй бол админд хандана уу
          </window.Label>
        </div>
      </div>
    </div>);

}

window.LoginA = LoginA;
window.LoginB = LoginB;
window.LoginC = LoginC;
window.LoginDesktop = LoginDesktop;