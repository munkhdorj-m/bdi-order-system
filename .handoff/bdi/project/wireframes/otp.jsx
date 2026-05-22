/* eslint-disable react/prop-types */
/**
 * OTP — 4 sample directions
 *
 * 1) Classic 4-box separated inputs (refined version of today)
 * 2) Single pill field with extra-large characters + paste hint
 * 3) Auto-detect from SMS — "Кодыг хүлээж байна…" with tap-to-fill banner
 * 4) Built-in numpad — no system keyboard flicker, faster on Android
 */

const Co = window.WF_COLORS;

function OtpHeader({ phone = "+976 8811 ••33" }) {
  return (
    <>
      <window.PhoneStatus />
      <div style={{ padding: "18px 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <window.Label size={16}>←</window.Label>
        <window.Label size={11} color={Co.muted}>Буцах</window.Label>
      </div>
      <div style={{ padding: "10px 18px 0" }}>
        <window.H size={20}>Кодоо оруулна уу</window.H>
        <window.Label size={12} color={Co.muted}>
          {phone} рүү SMS илгээгдсэн
        </window.Label>
      </div>
    </>
  );
}

function ResendStrip({ time = "0:42", style = {} }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 18px",
        marginTop: 10,
        ...style,
      }}
    >
      <window.Label size={11} color={Co.muted}>{time} дотор оруулна уу</window.Label>
      <window.Label size={11} color={Co.indigo}>Дахин илгээх</window.Label>
    </div>
  );
}

/* ---------- 1: Classic 4-box ---------- */
function Otp1() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <OtpHeader />

      <div style={{ padding: "26px 18px 0" }}>
        <window.Label size={11} color={Co.muted} style={{ display: "block", marginBottom: 8 }}>
          4 оронтой код
        </window.Label>
        <div style={{ display: "flex", gap: 10 }}>
          {[2, 4, 1, ""].map((d, i) => (
            <window.Box key={i} w={54} h={62} radius={12} shadow={i < 3}>
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Kalam', cursive",
                  fontSize: 28,
                  fontWeight: 700,
                  color: i < 3 ? Co.ink : Co.muted,
                  borderRadius: 12,
                  border: i === 3 ? `2px dashed ${Co.indigo}` : "none",
                  margin: -2,
                  background: i === 3 ? "#eef0ff" : "transparent",
                }}
              >
                {d || "_"}
              </div>
            </window.Box>
          ))}
        </div>
      </div>

      <ResendStrip />

      <div style={{ position: "absolute", right: -130, top: 200 }}>
        <window.Note w={160} rotate={4}>
          Танил pattern. Дөрвөн товчны хооронд auto-advance, paste handler хэрэгтэй.
        </window.Note>
      </div>

      <div style={{ marginTop: "auto", padding: 18 }}>
        <window.Btn primary h={46}>Үргэлжлүүлэх</window.Btn>
      </div>
    </div>
  );
}

/* ---------- 2: Single pill ---------- */
function Otp2() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <OtpHeader />

      <div style={{ padding: "28px 18px 0" }}>
        <window.Label size={11} color={Co.muted} style={{ display: "block", marginBottom: 8 }}>
          Код
        </window.Label>
        <div
          style={{
            border: `2px solid ${Co.ink}`,
            borderRadius: 16,
            background: "#fff",
            padding: "10px 16px",
            boxShadow: `1.5px 2px 0 ${Co.ink}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: "'Kalam', cursive",
              fontWeight: 700,
              fontSize: 38,
              letterSpacing: 14,
              flex: 1,
              lineHeight: 1,
            }}
          >
            2&nbsp;4&nbsp;1<span style={{ opacity: 0.3 }}>_</span>
          </div>
          <window.Label size={20} color={Co.muted}>⎘</window.Label>
        </div>
        <window.Label size={11} color={Co.muted} style={{ display: "block", marginTop: 6 }}>
          ⎘ Хуулсан кодыг paste хийх боломжтой
        </window.Label>
      </div>

      <ResendStrip />

      <div style={{ position: "absolute", right: -130, top: 200 }}>
        <window.Note w={160} rotate={5}>
          Нэг том field. Том type = зөв оруулахад амар. Paste icon чухал.
        </window.Note>
      </div>

      <div style={{ marginTop: "auto", padding: 18 }}>
        <window.Btn primary h={46}>Үргэлжлүүлэх</window.Btn>
      </div>
    </div>
  );
}

/* ---------- 3: Auto-detect from SMS ---------- */
function Otp3() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <OtpHeader />

      <div style={{ padding: "20px 18px 0" }}>
        {/* incoming SMS banner */}
        <div
          style={{
            background: "#eef0ff",
            border: `1.5px solid ${Co.ink}`,
            borderRadius: 14,
            padding: "10px 12px",
            display: "flex",
            gap: 10,
            alignItems: "center",
            boxShadow: `1.5px 2px 0 ${Co.ink}`,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: `1.5px solid ${Co.ink}`,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <window.Label size={16}>💬</window.Label>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <window.Label size={11} weight={700}>BDI · одоо</window.Label>
            <window.Label size={11} style={{ display: "block", lineHeight: 1.15 }}>
              Таны код: <span style={{ fontWeight: 700, fontFamily: "'Kalam', cursive", fontSize: 14 }}>2418</span>
            </window.Label>
          </div>
          <window.Btn h={28} w={null} primary style={{ padding: "0 10px", fontSize: 11 }}>
            ✓ Бөглөх
          </window.Btn>
        </div>

        <window.Label size={11} color={Co.muted} style={{ display: "block", marginTop: 14, marginBottom: 8 }}>
          эсвэл гараар оруулна уу
        </window.Label>
        <div style={{ display: "flex", gap: 8 }}>
          {["", "", "", ""].map((d, i) => (
            <window.Box key={i} w={50} h={54} radius={10} dashed>
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Kalam', cursive",
                  fontSize: 24,
                  color: Co.muted,
                }}
              >
                _
              </div>
            </window.Box>
          ))}
        </div>
      </div>

      <ResendStrip time="0:48" />

      <div style={{ position: "absolute", right: -130, top: 180 }}>
        <window.Note w={160} rotate={4} color="#ffd4cc">
          SMS Retriever (Android) ашиглаж auto-fill. iOS-д "From Messages"
          AutoFill. Гар оролт fallback хэвээр.
        </window.Note>
      </div>

      <div style={{ marginTop: "auto", padding: 18 }}>
        <window.Btn primary h={46}>Үргэлжлүүлэх</window.Btn>
      </div>
    </div>
  );
}

/* ---------- 4: Built-in numpad ---------- */
function Otp4() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <OtpHeader />

      <div style={{ padding: "18px 18px 0" }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {["2", "4", "1", "•"].map((d, i) => (
            <div
              key={i}
              style={{
                width: 44,
                height: 50,
                borderBottom: `3px solid ${i < 3 ? Co.ink : Co.indigo}`,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 4,
                fontFamily: "'Kalam', cursive",
                fontWeight: 700,
                fontSize: 30,
                color: i < 3 ? Co.ink : Co.muted,
              }}
            >
              {d === "•" ? "" : d}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
          <window.Label size={10} color={Co.muted}>3 / 4 оронтой</window.Label>
        </div>
      </div>

      {/* Built-in numpad */}
      <div style={{ padding: "14px 18px", marginTop: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 6,
            background: "#efeadd",
            border: `1.5px solid ${Co.ink}`,
            borderRadius: 10,
            padding: 6,
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
            <div
              key={i}
              style={{
                height: 42,
                background: k === "" ? "transparent" : "#fff",
                border: k === "" ? "none" : `1.2px solid ${Co.ink}`,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Kalam', cursive",
                fontSize: k === "⌫" ? 16 : 20,
                fontWeight: 700,
                boxShadow: k === "" ? "none" : `1px 1.5px 0 ${Co.ink}`,
                color: Co.ink,
              }}
            >
              {k}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <window.Btn primary h={46}>Үргэлжлүүлэх</window.Btn>
        </div>
      </div>

      <div style={{ position: "absolute", left: -140, top: 180 }}>
        <window.Note w={170} rotate={-4} color="#ffd4cc">
          Гар нь дэлгэцэн дээр аль хэдийн = keyboard flicker байхгүй.
          Том key = thumb-only хэрэглээнд тохиромжтой.
        </window.Note>
      </div>
    </div>
  );
}

window.Otp1 = Otp1;
window.Otp2 = Otp2;
window.Otp3 = Otp3;
window.Otp4 = Otp4;
