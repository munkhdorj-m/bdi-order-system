/* eslint-disable react/prop-types */
/**
 * Buyer hi-fi screens (Confident language) — remaining mobile screens:
 *   - BuyerLogin (phone entry)
 *   - BuyerOtp (4-digit code, auto-detect banner pattern from OTP exploration #3)
 *   - BuyerOrderPlaced (confirmation, replaces B5)
 *   - BuyerOrderDetail (B6 detail — status timeline + line items + reorder)
 */

const { I, fmt, ProductImage, StoreHeader, TabBar, StatusPill, PRODUCTS, Icon } = window;

/* ─────────── 1. Login ─────────── */
function BuyerLogin() {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Brand block */}
      <div className="relative px-6 pt-16 pb-10" style={{
        background: "linear-gradient(155deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 78%, black) 100%)",
      }}>
        <div className="text-primary-foreground">
          <div className="size-12 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/25 flex items-center justify-center font-bold text-base">BDI</div>
          <h1 className="mt-6 text-[26px] font-bold tracking-tight leading-tight">
            Захиалга өгөх<br />хамгийн хялбар арга
          </h1>
          <p className="mt-2 text-[14px] opacity-85 max-w-[280px]">
            BDI-н бөөний бараагаа дэлгүүрээсээ шууд захиалаарай.
          </p>
        </div>
        {/* curved bottom */}
        <div className="absolute left-0 right-0 -bottom-px h-5 bg-background rounded-t-3xl" />
      </div>

      <div className="flex-1 px-6 pt-7 flex flex-col">
        <label className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
          Утасны дугаар
        </label>
        <div className="mt-2 h-13 rounded-2xl ring-1 ring-border bg-white flex items-stretch overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all"
             style={{ height: 52 }}>
          <div className="flex items-center px-3.5 bg-muted text-[14px] font-semibold border-r border-border">+976</div>
          <div className="flex-1 flex items-center px-3.5 text-[16px] font-semibold tracking-wide tabular-nums">8811 ____</div>
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground leading-relaxed">
          Бүртгүүлсэн дугаараа оруулна уу. Бид SMS-ээр баталгаажуулах код илгээх болно.
        </p>

        <button className="mt-5 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] transition-all">
          Код илгээх
          <span className="opacity-80">{I.chevR}</span>
        </button>

        <div className="mt-auto pt-6 pb-2 text-center text-[12px] text-muted-foreground">
          Бүртгэлгүй юу? <a className="font-semibold text-primary">Админд хандах</a>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 2. OTP ─────────── */
function BuyerOtp() {
  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 flex items-center px-3 sticky top-0 bg-background/85 backdrop-blur-xl">
        <button className="-ml-1 size-9 rounded-xl flex items-center justify-center bg-muted ring-1 ring-border">{I.back}</button>
        <div className="ml-2 leading-tight">
          <div className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Буцах</div>
          <div className="text-[13px] font-semibold">Кодоо оруулна уу</div>
        </div>
      </header>

      <div className="flex-1 px-6 pt-6 flex flex-col">
        <h1 className="text-[22px] font-bold tracking-tight">SMS код</h1>
        <p className="text-[13px] text-muted-foreground mt-1.5">
          <span className="font-semibold text-foreground">+976 8811 ••33</span> рүү 4 оронтой код илгээгдсэн
        </p>

        {/* Auto-detect banner (from OTP exploration #3) */}
        <div className="mt-5 rounded-2xl bg-accent ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] p-3 flex items-center gap-3 shadow-sm">
          <div className="size-10 rounded-xl bg-white ring-1 ring-border flex items-center justify-center">
            <Icon d={<><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 10h8M8 14h5" /></>} size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-primary">BDI · одоо</div>
            <div className="text-[12.5px] font-semibold">Таны код: <span className="font-mono">2418</span></div>
          </div>
          <button className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-bold flex items-center gap-1.5 shadow-sm active:scale-[0.97]">
            {I.check} Бөглөх
          </button>
        </div>

        <div className="mt-7 text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
          эсвэл гараар
        </div>
        <div className="mt-3 flex gap-2.5">
          {[2, 4, 1, ""].map((d, i) => (
            <div key={i}
              className={`flex-1 aspect-[5/6] rounded-2xl bg-white flex items-center justify-center text-[28px] font-bold tabular-nums transition-all ${
                i === 3 ? "ring-2 ring-primary" : "ring-1 ring-border"
              } ${d ? "" : "text-muted-foreground/30"}`}
            >
              {d || "_"}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground tabular-nums">0:42 дотор оруулна уу</span>
          <button className="font-semibold text-muted-foreground/60">Дахин илгээх</button>
        </div>

        <button className="mt-auto mb-2 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] transition-all">
          Үргэлжлүүлэх
        </button>
      </div>
    </div>
  );
}

/* ─────────── 3. Order placed confirmation ─────────── */
function BuyerOrderPlaced() {
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-10 overflow-hidden">
        {/* Confetti backdrop */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 25%, transparent) 0%, transparent 50%), radial-gradient(circle at 70% 70%, color-mix(in oklch, var(--chart-emerald) 25%, transparent) 0%, transparent 50%)",
          }}
        />
        {/* Check */}
        <div className="relative">
          <div className="size-24 rounded-full flex items-center justify-center text-white shadow-xl"
               style={{ background: "linear-gradient(135deg, oklch(0.7 0.16 155), oklch(0.55 0.16 155))",
                        boxShadow: "0 16px 40px -10px color-mix(in oklch, var(--chart-emerald) 50%, transparent)" }}>
            <Icon d={<path d="M5 12l5 5L20 7" />} size={44} sw={3} />
          </div>
          {/* Sparkles */}
          <span className="absolute -top-1 -right-3 size-3 rounded-full" style={{ background: "var(--chart-amber)" }} />
          <span className="absolute -bottom-1 -left-5 size-2.5 rounded-full" style={{ background: "var(--primary)" }} />
          <span className="absolute top-6 -right-7 size-2 rounded-full" style={{ background: "var(--chart-emerald)" }} />
        </div>

        <h1 className="relative mt-7 text-[24px] font-bold tracking-tight">Захиалга илгээгдлээ!</h1>
        <p className="relative mt-1.5 text-[13.5px] text-muted-foreground text-center max-w-[270px] leading-relaxed">
          BDI таны захиалгыг хүлээж авлаа.<br />Удахгүй холбогдох болно.
        </p>

        <div className="relative mt-7 rounded-2xl bg-white ring-1 ring-border shadow-md shadow-black/5 px-5 py-4 w-full max-w-sm">
          <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Захиалгын дугаар</div>
          <div className="mt-1 text-[20px] font-bold font-mono tracking-tight">ORD-2026-00042</div>
          <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-border">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground">Бараа</div>
              <div className="text-[14px] font-bold tabular-nums">3</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground">Нийт</div>
              <div className="text-[14px] font-bold tabular-nums">{fmt(4690)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground">Хүргэлт</div>
              <div className="text-[12.5px] font-semibold">Маргааш</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 flex flex-col gap-2 bg-background">
        <button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98]">
          Захиалгаа харах
          <span className="opacity-80">{I.chevR}</span>
        </button>
        <button className="w-full h-11 rounded-2xl text-[13px] font-semibold text-muted-foreground hover:bg-muted">
          Каталог руу буцах
        </button>
      </div>
    </div>
  );
}

/* ─────────── 4. Order detail (buyer) ─────────── */
function BuyerOrderDetail() {
  const order = {
    n: "ORD-2026-00042", d: "2026-05-11 · 14:32", status: "pending", statusLabel: "Хүлээгдэж буй",
    eta: "Маргааш 09:00 — 11:00", items: 3, subtotal: 4690,
    note: "Маргааш 10цаг хүртэл хүргэх боломжтой бол хүргэнэ үү",
    lines: [
      { ...PRODUCTS[0], qty: 2 },
      { ...PRODUCTS[1], qty: 1 },
      { ...PRODUCTS[5], qty: 3 },
    ],
    timeline: [
      { t: "Үүсгэгдсэн",  d: "5/11 · 14:32", done: true },
      { t: "Баталгаажсан", d: "5/11 · 14:45", done: true },
      { t: "Багцлагдсан",  d: "—", done: false, current: true },
      { t: "Хүргэгдсэн",   d: "—", done: false },
    ],
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <StoreHeader back title={order.n} sub="Захиалга" />

      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3">
        {/* Status hero card */}
        <div className="rounded-3xl ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] bg-[color-mix(in_oklch,var(--primary)_5%,white)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Статус</div>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill status={order.status} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Нийт</div>
              <div className="text-[18px] font-bold tabular-nums">{fmt(order.subtotal)}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[12.5px]">
            {I.truck}<span className="text-foreground/80">{order.eta}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-5 px-1">
          <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-3">Явц</div>
          <div className="flex flex-col gap-3">
            {order.timeline.map((step, i) => (
              <div key={i} className="flex gap-3 items-start relative">
                <div className="flex flex-col items-center">
                  <div className={`size-6 rounded-full flex items-center justify-center ${
                    step.done ? "bg-primary text-primary-foreground" :
                    step.current ? "bg-amber-100 ring-2 ring-amber-400 text-amber-900" :
                    "bg-muted ring-1 ring-border text-muted-foreground"
                  }`}>
                    {step.done ? <Icon d={<path d="M5 12l5 5L20 7" />} size={12} sw={3} /> :
                     step.current ? <span className="size-1.5 rounded-full bg-amber-500" /> :
                     <span className="size-1 rounded-full bg-muted-foreground/40" />}
                  </div>
                  {i < order.timeline.length - 1 && (
                    <div className="w-0.5 h-6" style={{ background: step.done ? "var(--primary)" : "var(--border)" }} />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <div className={`text-[13px] font-semibold ${step.done || step.current ? "" : "text-muted-foreground"}`}>{step.t}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{step.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-2 flex items-center justify-between px-1">
            <span>Бараа · {order.items}</span>
            <span className="font-mono text-foreground/70 normal-case tracking-normal">{order.d}</span>
          </div>
          <div className="flex flex-col gap-2">
            {order.lines.map((p) => (
              <div key={p.id} className="flex gap-3 p-3 rounded-2xl bg-white ring-1 ring-border">
                <div className="size-16 rounded-xl overflow-hidden relative shrink-0">
                  <ProductImage hue={p.hue} dense />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-primary">{p.brand}</div>
                  <div className="text-[12.5px] font-semibold leading-snug line-clamp-2">{p.name}</div>
                  <div className="mt-1 flex items-center justify-between text-[11.5px] text-muted-foreground tabular-nums">
                    <span>{fmt(p.price)} × {p.qty}</span>
                    <span className="font-bold text-foreground">{fmt(p.price * p.qty)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="mt-4 rounded-2xl bg-muted/60 ring-1 ring-border p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-1.5">
            {I.note} Тэмдэглэл
          </div>
          <p className="text-[12.5px] leading-relaxed text-foreground/85">{order.note}</p>
        </div>
      </div>

      <div className="border-t border-border bg-background px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex gap-2">
        <button className="flex-1 h-11 rounded-2xl text-[13px] font-semibold border border-border bg-white active:scale-[0.98] flex items-center justify-center gap-1.5">
          {I.phone} BDI-д залгах
        </button>
        <button className="flex-1 h-11 rounded-2xl text-[13px] font-bold bg-primary text-primary-foreground shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] flex items-center justify-center gap-1.5">
          {I.cart} Дахин захиалах
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { BuyerLogin, BuyerOtp, BuyerOrderPlaced, BuyerOrderDetail });
