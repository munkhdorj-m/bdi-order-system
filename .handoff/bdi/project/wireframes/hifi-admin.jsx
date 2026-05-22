/* eslint-disable react/prop-types */
/**
 * Admin hi-fi desktop screens (Confident language):
 *   - AdminLogin
 *   - AdminDashboard (A2)
 *   - AdminOrdersList (A3) — pending queue with inline confirm
 *   - AdminOrderDetail (A4)
 *   - AdminProductsList (A5)
 *   - AdminProductEdit (A5b) — edit dialog
 *   - AdminStoresList (A6)
 *   - AdminPriceList (A7) — per-store override editor
 *   - AdminUsersList (A8)
 */

const { I, fmt, ProductImage, AdminSidebar, AdminTopbar, StatusPill, PRODUCTS, STORES, ORDERS, Icon } = window;

/* ─────────── Admin login ─────────── */
function AdminLogin() {
  return (
    <div className="h-full flex bg-background">
      {/* Brand side */}
      <div className="w-2/5 relative flex flex-col justify-between p-12 text-white"
        style={{ background: "linear-gradient(155deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 78%, black) 100%)" }}>
        <div>
          <div className="size-12 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/25 flex items-center justify-center font-bold text-base">BDI</div>
          <h1 className="mt-12 text-[34px] font-bold tracking-tight leading-tight">
            Захиалгын<br />удирдлагын систем
          </h1>
          <p className="mt-3 text-[14.5px] opacity-85 max-w-[320px] leading-relaxed">
            BDI-н ажилтнуудад зориулсан админ хэсэг. Захиалга, бараа, үнэ, дэлгүүрүүдийг нэг дороос удирдана.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-white/85">
          {[
            { v: "247", l: "Захиалга" },
            { v: "56",  l: "SKU" },
            { v: "23",  l: "Дэлгүүр" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-4 py-3">
              <div className="text-[22px] font-bold tabular-nums tracking-tight">{s.v}</div>
              <div className="text-[11px] opacity-80">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-primary">Админ нэвтрэх</div>
          <h2 className="mt-1 text-[26px] font-bold tracking-tight">Тавтай морил</h2>
          <p className="text-[13px] text-muted-foreground mt-1">Үргэлжлүүлэхийн тулд нэвтэрнэ үү</p>

          <div className="mt-6 space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Утас</label>
              <div className="mt-1.5 h-11 rounded-xl ring-1 ring-border bg-white flex items-stretch overflow-hidden">
                <div className="flex items-center px-3 bg-muted text-[13px] font-semibold border-r border-border">+976</div>
                <div className="flex-1 flex items-center px-3 text-[14px] font-semibold tracking-wide">9911 4422</div>
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Нууц үг</label>
              <div className="mt-1.5 h-11 rounded-xl ring-1 ring-border bg-white px-3.5 flex items-center justify-between text-[14px] font-semibold tracking-wide">
                <span>••••••••</span>
                <button className="text-muted-foreground text-[11.5px] font-semibold">Харах</button>
              </div>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <label className="flex items-center gap-2">
                <span className="size-4 rounded ring-1 ring-border bg-white flex items-center justify-center text-primary">{<Icon d={<path d="M5 12l5 5L20 7" />} size={11} sw={3} />}</span>
                Намайг сана
              </label>
              <a className="text-primary font-semibold">Нууц үг мартсан?</a>
            </div>
            <button className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-[13.5px] shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98]">
              Нэвтрэх
            </button>
          </div>

          <div className="mt-12 text-center text-[11px] text-muted-foreground">
            © 2026 BDI · Захиалгын систем
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Dashboard ─────────── */
function AdminDashboard() {
  const stats = [
    { l: "Шинэ захиалга",    v: 12,   tone: "amber",   icon: I.bell,  alert: true, sub: "5 хүлээгдсээр" },
    { l: "Идэвхтэй захиалга", v: 8,    tone: "primary",icon: I.clip, sub: "Багцлаж + Илгээсэн" },
    { l: "7 хоногийн нийт",   v: "1.4M ₮", tone: "emerald", icon: <Icon d={<><path d="M3 21V3M3 21h18M7 14v3M12 9v8M17 5v12" /></>} />, sub: "↗ 12% өмнөх 7 хоног" },
    { l: "SKU нөөц багатай",  v: 3,    tone: "rose",    icon: I.warn, alert: true, sub: "Дуусаагүй: 1" },
  ];
  const TONES = {
    amber:   { bg: "bg-amber-100",   tx: "text-amber-700",  pill: "bg-amber-50 ring-amber-300/60 text-amber-900" },
    primary: { bg: "bg-[color-mix(in_oklch,var(--primary)_15%,white)]",  tx: "text-primary",  pill: "" },
    emerald: { bg: "bg-[color-mix(in_oklch,var(--chart-emerald)_15%,white)]",  tx: "text-[oklch(0.4_0.13_155)]", pill: "" },
    rose:    { bg: "bg-rose-100",    tx: "text-rose-700",   pill: "" },
  };

  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="dashboard" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Дашбоард"]} />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight">Дашбоард</h1>
              <p className="text-[13px] text-muted-foreground">Өнөөдөр · 2026-05-11 · Б. Мөнхдорж</p>
            </div>
            <div className="flex gap-2">
              {["Өнөөдөр", "7 хоног", "Сар"].map((t, i) => (
                <button key={t} className={`h-8 px-3 rounded-lg text-[12px] font-semibold ${
                  i === 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-[oklch(0.95_0.005_264)]"
                }`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-4 gap-3">
            {stats.map((s) => {
              const t = TONES[s.tone];
              return (
                <div key={s.l} className={`relative rounded-2xl bg-white ring-1 ring-border p-4 transition-all hover:shadow-md ${s.alert ? "ring-[color-mix(in_oklch,var(--chart-amber)_30%,transparent)]" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className={`size-9 rounded-xl flex items-center justify-center ${t.bg} ${t.tx}`}>{s.icon}</div>
                    {s.alert && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}
                  </div>
                  <div className="mt-3 text-[28px] font-bold tabular-nums tracking-tight">{s.v}</div>
                  <div className="text-[12.5px] text-muted-foreground">{s.l}</div>
                  {s.sub && <div className="text-[11px] text-muted-foreground/80 mt-1">{s.sub}</div>}
                </div>
              );
            })}
          </div>

          {/* Pending queue (action-first) + sidebar widgets */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="col-span-2 rounded-2xl bg-white ring-1 ring-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
                <h2 className="text-[15px] font-bold tracking-tight">Хүлээгдэж буй захиалга</h2>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 ring-1 ring-amber-300/60">
                  <span className="size-1.5 rounded-full bg-amber-500" /> 12
                </span>
                <button className="ml-auto text-[12px] font-semibold text-primary">Бүгд ›</button>
              </div>
              <div className="divide-y divide-border">
                {ORDERS.filter(o => o.status === "pending").slice(0, 4).map((o) => (
                  <div key={o.n} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40">
                    <div className="leading-tight">
                      <div className="text-[12.5px] font-mono font-semibold">{o.n}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{o.store} · {o.ago} өмнө</div>
                    </div>
                    <div className="ml-auto text-[14px] font-bold tabular-nums w-24 text-right">{fmt(o.total)}</div>
                    <button className="h-8 px-3 rounded-lg text-[11.5px] font-semibold border border-border bg-white hover:bg-muted">Үзэх</button>
                    <button className="h-8 px-3 rounded-lg text-[11.5px] font-bold bg-primary text-primary-foreground shadow-sm flex items-center gap-1.5">
                      {I.check} Баталгаажуулах
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              {/* Low stock */}
              <div className="rounded-2xl bg-white ring-1 ring-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-bold">Нөөц багатай</h3>
                  <span className="text-[10px] uppercase tracking-[0.1em] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">3</span>
                </div>
                <div className="mt-3 space-y-2">
                  {PRODUCTS.filter(p => p.low || p.out).map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <div className="size-9 rounded-lg overflow-hidden relative ring-1 ring-border/40 shrink-0">
                        <ProductImage hue={p.hue} dense />
                      </div>
                      <div className="leading-tight min-w-0 flex-1">
                        <div className="text-[11.5px] font-semibold truncate">{p.name}</div>
                        <div className={`text-[10.5px] tabular-nums font-semibold ${p.out ? "text-rose-600" : "text-amber-700"}`}>
                          {p.out ? "Дууссан" : `Үлдсэн: ${p.stock}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini sparkline */}
              <div className="rounded-2xl bg-white ring-1 ring-border p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[13px] font-bold">Долоо хоногийн орлого</h3>
                  <span className="text-[11px] font-semibold text-[oklch(0.4_0.13_155)]">↗ 12%</span>
                </div>
                <div className="mt-3 flex items-end gap-1.5 h-16">
                  {[24, 38, 22, 45, 31, 52, 41].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md transition-all"
                      style={{ height: `${h * 1.3}%`, background: i === 6 ? "var(--primary)" : "color-mix(in oklch, var(--primary) 22%, transparent)" }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground tabular-nums">
                  {["М", "Б", "Л", "П", "Б", "Б", "Н"].map((d, i) => <span key={i}>{d}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Orders list ─────────── */
function AdminOrdersList() {
  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="orders" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Захиалга"]} actions={
          <button className="ml-3 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-bold flex items-center gap-1.5 shadow-sm">
            {I.plus} Шинэ захиалга
          </button>
        } />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight">Захиалгууд</h1>
              <p className="text-[13px] text-muted-foreground">Нийт 247 захиалга</p>
            </div>
          </div>

          {/* Filter chips */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {[
              { l: "Бүгд · 247", a: false },
              { l: "🟡 Шинэ · 12",   a: true },
              { l: "🟦 Багцлаж · 5", a: false },
              { l: "🚚 Илгээсэн · 3", a: false },
              { l: "🟢 Хүргэгдсэн", a: false },
            ].map((c) => (
              <button key={c.l} className={`h-8 px-3 rounded-full text-[12px] font-semibold ${
                c.a ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-[oklch(0.95_0.005_264)]"
              }`}>{c.l}</button>
            ))}
            <div className="ml-auto flex gap-2">
              <button className="h-8 px-3 rounded-lg bg-white ring-1 ring-border text-[12px] flex items-center gap-1.5 hover:bg-muted">
                {I.filter} Дэлгүүр {I.chevD}
              </button>
              <button className="h-8 px-3 rounded-lg bg-white ring-1 ring-border text-[12px] flex items-center gap-1.5 hover:bg-muted">
                Огноо {I.chevD}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 rounded-2xl bg-white ring-1 ring-border overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2.5 w-44">Дугаар</th>
                  <th className="text-left px-3 py-2.5">Дэлгүүр</th>
                  <th className="text-left px-3 py-2.5 w-40">Статус</th>
                  <th className="text-left px-3 py-2.5 w-20">Бараа</th>
                  <th className="text-right px-3 py-2.5 w-28">Үнэ</th>
                  <th className="text-left px-3 py-2.5 w-32">Огноо</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ORDERS.map((o) => (
                  <tr key={o.n} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3 font-mono font-semibold">{o.n}</td>
                    <td className="px-3 py-3">{o.store}</td>
                    <td className="px-3 py-3"><StatusPill status={o.status} /></td>
                    <td className="px-3 py-3 tabular-nums">{o.items}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{fmt(o.total)}</td>
                    <td className="px-3 py-3 text-muted-foreground tabular-nums">{o.d}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground"><button className="hover:text-foreground">{I.chevR}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Order detail ─────────── */
function AdminOrderDetail() {
  const order = {
    n: "ORD-2026-00042", store: "Хүнс-Мини", mgr: "Б. Энхээ", phone: "+976 8811 2233",
    d: "2026-05-11 · 14:32", status: "pending", subtotal: 4690, items: 3,
    note: "Маргааш 10цаг хүртэл хүргэх боломжтой бол хүргэнэ үү",
    lines: [
      { ...PRODUCTS[0], qty: 2 },
      { ...PRODUCTS[1], qty: 1 },
      { ...PRODUCTS[5], qty: 3 },
    ],
    timeline: [
      { t: "Үүсгэгдсэн",   d: "5/11 · 14:32", done: true },
      { t: "Баталгаажсан", d: "Хүлээгдэж буй", done: false, current: true },
      { t: "Багцлагдсан",  d: "—", done: false },
      { t: "Хүргэгдсэн",   d: "—", done: false },
    ],
  };

  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="orders" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Захиалга", order.n]} actions={
          <div className="ml-3 flex gap-2">
            <button className="h-9 px-3.5 rounded-lg bg-white ring-1 ring-border text-[12.5px] font-semibold hover:bg-muted">Цуцлах</button>
            <button className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-bold flex items-center gap-1.5 shadow-sm">
              {I.check} Баталгаажуулах
            </button>
          </div>
        } />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[26px] font-bold tracking-tight font-mono">{order.n}</h1>
            <StatusPill status={order.status} />
          </div>
          <p className="text-[13px] text-muted-foreground">{order.d}</p>

          <div className="mt-5 grid grid-cols-3 gap-4">
            {/* Left: order info + lines */}
            <div className="col-span-2 flex flex-col gap-4">
              {/* Store info card */}
              <div className="rounded-2xl bg-white ring-1 ring-border p-4 flex items-center gap-4">
                <div className="size-11 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground flex items-center justify-center font-bold text-base">Х</div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Дэлгүүр</div>
                  <div className="text-[15px] font-bold">{order.store}</div>
                </div>
                <div className="flex flex-col gap-1 text-[12.5px]">
                  <div className="flex items-center gap-1.5"><span className="text-muted-foreground">{I.user}</span>{order.mgr}</div>
                  <div className="flex items-center gap-1.5"><span className="text-muted-foreground">{I.phone}</span>{order.phone}</div>
                </div>
              </div>

              {/* Lines */}
              <div className="rounded-2xl bg-white ring-1 ring-border overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                  <h2 className="text-[15px] font-bold tracking-tight">Бараа</h2>
                  <span className="text-[11px] text-muted-foreground">{order.items} ширхэг</span>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                    <tr>
                      <th className="text-left px-5 py-2.5">Бараа</th>
                      <th className="text-right px-3 py-2.5 w-16">Тоо</th>
                      <th className="text-right px-3 py-2.5 w-24">Үнэ</th>
                      <th className="text-right px-5 py-2.5 w-28">Дүн</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.lines.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg overflow-hidden relative ring-1 ring-border/40 shrink-0">
                              <ProductImage hue={p.hue} dense />
                            </div>
                            <div className="leading-tight min-w-0">
                              <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-primary">{p.brand}</div>
                              <div className="text-[12.5px] font-semibold">{p.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{p.qty}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmt(p.price)}</td>
                        <td className="px-5 py-3 text-right font-bold tabular-nums">{fmt(p.price * p.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40">
                    <tr>
                      <td colSpan={3} className="px-5 py-3 text-right text-[12.5px] font-semibold">Нийт</td>
                      <td className="px-5 py-3 text-right text-[15px] font-bold tabular-nums">{fmt(order.subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Note */}
              <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-300/60 p-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-bold text-amber-900 mb-1.5">
                  {I.note} Худалдан авагчийн тэмдэглэл
                </div>
                <p className="text-[13px] leading-relaxed text-amber-950">{order.note}</p>
              </div>
            </div>

            {/* Right: timeline */}
            <div className="rounded-2xl bg-white ring-1 ring-border p-5">
              <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-3">Төлвийн түүх</div>
              <div className="flex flex-col gap-3">
                {order.timeline.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
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
                      {i < order.timeline.length - 1 && <div className="w-0.5 h-7" style={{ background: step.done ? "var(--primary)" : "var(--border)" }} />}
                    </div>
                    <div className="flex-1 pb-2 leading-tight">
                      <div className={`text-[12.5px] font-semibold ${step.done || step.current ? "" : "text-muted-foreground"}`}>{step.t}</div>
                      <div className="text-[10.5px] text-muted-foreground">{step.d}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-border space-y-2 text-[12px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Захиалсан</span><span className="font-semibold">{order.mgr}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Утас</span><span className="font-mono">{order.phone}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Хүргэлт</span><span className="font-semibold">Маргааш</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Products list ─────────── */
function AdminProductsList() {
  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="products" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Бараа"]} actions={
          <div className="ml-3 flex gap-2">
            <button className="h-9 px-3.5 rounded-lg bg-white ring-1 ring-border text-[12.5px] font-semibold hover:bg-muted flex items-center gap-1.5">
              {I.upload} Excel импорт
            </button>
            <button className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-bold flex items-center gap-1.5 shadow-sm">
              {I.plus} Шинэ бараа
            </button>
          </div>
        } />

        <div className="flex-1 overflow-y-auto p-6">
          <h1 className="text-[26px] font-bold tracking-tight">Бараа</h1>
          <p className="text-[13px] text-muted-foreground">Нийт 56 SKU</p>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold">Бүгд · 56</button>
            <button className="h-8 px-3 rounded-full bg-muted text-muted-foreground text-[12px] font-semibold ring-1 ring-border">Цаас · 18</button>
            <button className="h-8 px-3 rounded-full bg-muted text-muted-foreground text-[12px] font-semibold ring-1 ring-border">Хөвөн · 12</button>
            <button className="h-8 px-3 rounded-full bg-muted text-muted-foreground text-[12px] font-semibold ring-1 ring-border">Угаалга · 14</button>
            <button className="h-8 px-3 rounded-full bg-rose-100 text-rose-700 text-[12px] font-semibold ring-1 ring-rose-300/60 flex items-center gap-1.5">
              {I.warn} Нөөц багатай · 3
            </button>
          </div>

          {/* Grid */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {PRODUCTS.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white ring-1 ring-border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                <div className="aspect-[4/3] relative overflow-hidden">
                  <ProductImage hue={p.hue} />
                  {p.out && (
                    <div className="absolute top-2 left-2 text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: "var(--chart-coral)" }}>Дууссан</div>
                  )}
                  {p.low && !p.out && (
                    <div className="absolute top-2 left-2 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full ring-1 ring-amber-300/60">Цөөн</div>
                  )}
                  {p.deal && (
                    <div className="absolute top-2 right-2 text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: "var(--chart-coral)" }}>−10%</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-primary line-clamp-1">{p.brand}</div>
                  <div className="text-[12.5px] font-semibold leading-snug line-clamp-2 h-[2.4em] mt-0.5">{p.name}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[13px] font-bold tabular-nums">{fmt(p.price)}</span>
                    <span className={`text-[10.5px] font-semibold tabular-nums ${p.out ? "text-rose-600" : p.low ? "text-amber-700" : "text-muted-foreground"}`}>
                      Үлд: {p.stock}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Product edit dialog ─────────── */
function AdminProductEdit() {
  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="products" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Бараа", "Soft Leaf салфетка 10ш"]} />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-baseline justify-between">
              <div>
                <h1 className="text-[24px] font-bold tracking-tight">Soft Leaf салфетка 10ш</h1>
                <p className="text-[13px] text-muted-foreground font-mono">SKU: 4890326012629</p>
              </div>
              <div className="flex gap-2">
                <button className="h-9 px-3 rounded-lg bg-white ring-1 ring-border text-[12.5px] font-semibold hover:bg-muted">Цуцлах</button>
                <button className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-bold shadow-sm">Хадгалах</button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-5">
              {/* Image */}
              <div className="col-span-1">
                <div className="aspect-square rounded-2xl ring-1 ring-border overflow-hidden relative bg-white">
                  <ProductImage hue={165} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[165, 185, 145].map((h, i) => (
                    <div key={i} className={`aspect-square rounded-xl overflow-hidden relative ${i === 0 ? "ring-2 ring-primary" : "ring-1 ring-border"}`}>
                      <ProductImage hue={h} dense />
                    </div>
                  ))}
                </div>
                <button className="mt-2 w-full h-10 rounded-xl border-2 border-dashed border-border bg-muted/40 text-[12px] font-semibold text-muted-foreground hover:bg-muted flex items-center justify-center gap-1.5">
                  {I.upload} Зураг нэмэх
                </button>
              </div>

              {/* Fields */}
              <div className="col-span-2 space-y-4">
                <div className="rounded-2xl bg-white ring-1 ring-border p-5">
                  <h3 className="text-[13px] font-bold mb-3.5">Үндсэн мэдээлэл</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Нэр" value="Soft Leaf салфетка 10ш" wide />
                    <Field label="Бренд" value="Soft Leaf" />
                    <Field label="SKU / Barcode" value="4890326012629" mono />
                    <Field label="Ангилал" value="Ариутгал ⌄" select />
                    <Field label="Хайрцагт ширхэг" value="120" />
                  </div>
                  <div className="mt-3">
                    <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Тайлбар</label>
                    <textarea className="mt-1.5 w-full h-20 rounded-xl ring-1 ring-border bg-white px-3.5 py-2.5 text-[13px] resize-none" defaultValue="Нян бактерийн 99.9%-ийг устгадаг, гар болон бараа ариутгахад зориулсан нойтон салфетка." />
                  </div>
                </div>

                <div className="rounded-2xl bg-white ring-1 ring-border p-5">
                  <h3 className="text-[13px] font-bold mb-3.5">Үнэ ба нөөц</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Жишиг үнэ (₮)" value="1,220" mono bold />
                    <Field label="Кассын үнэ (₮)" value="1,100" mono bold hint="Зөвхөн админд харагдана" />
                    <Field label="Нөөц" value="48" mono bold />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, wide, select, mono, bold, hint }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">{label}</label>
      <div className={`mt-1.5 h-10 rounded-xl ring-1 ring-border bg-white px-3.5 flex items-center text-[13px] ${mono ? "font-mono" : ""} ${bold ? "font-bold tabular-nums" : "font-semibold"}`}>
        {value}{select && <span className="ml-auto text-muted-foreground">{window.I.chevD}</span>}
      </div>
      {hint && <div className="mt-1 text-[10.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* ─────────── Stores list ─────────── */
function AdminStoresList() {
  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="stores" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Дэлгүүр"]} actions={
          <button className="ml-3 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-bold flex items-center gap-1.5 shadow-sm">
            {I.plus} Дэлгүүр нэмэх
          </button>
        } />

        <div className="flex-1 overflow-y-auto p-6">
          <h1 className="text-[26px] font-bold tracking-tight">Дэлгүүрүүд</h1>
          <p className="text-[13px] text-muted-foreground">Нийт 23 дэлгүүр</p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {STORES.map((s) => (
              <div key={s.name} className="rounded-2xl bg-white ring-1 ring-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground flex items-center justify-center font-bold text-base shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold truncate">{s.name}</div>
                    <div className="text-[11.5px] text-muted-foreground">{s.mgr}</div>
                  </div>
                  {s.status === "hot" && <span className="size-2 rounded-full bg-emerald-500" />}
                  {s.status === "warn" && <span className="size-2 rounded-full bg-amber-500" />}
                </div>
                <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-[12px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">{I.phone}<span className="font-mono">{s.phone}</span></div>
                  <div className="flex items-center gap-1.5"><span className={s.status === "warn" ? "text-amber-700" : "text-muted-foreground"}>{I.clock}</span>{s.last}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Энэ сард <span className="font-bold text-foreground tabular-nums">{s.visits}</span> захиалга</span>
                  <button className="text-[11.5px] font-semibold text-primary">Үнийн жагсаалт ›</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Price list editor (A7) — Diff style ─────────── */
function AdminPriceList() {
  const rows = [
    { name: "Soft Leaf салфетка 10ш",   base: 1220, own: 1180, hue: 165 },
    { name: "Soft Leaf салфетка 25ш",   base: 2250, own: null, hue: 140 },
    { name: "Хөвөн дэвсгэр 50ш",         base: 2150, own: 2050, hue: 215 },
    { name: "Угаалгын нунтаг 1кг",        base: 8400, own: null, hue: 200 },
    { name: "Ариутгал 500мл",            base: 5650, own: 5400, hue: 25  },
    { name: "Шингэн саван 750мл",         base: 3900, own: null, hue: 50  },
    { name: "Гарын саван хатамал",        base: 1850, own: 1750, hue: 280 },
    { name: "Гар алчуур 100ш",            base: 4100, own: null, hue: 120 },
  ];
  const overrides = rows.filter(r => r.own != null).length;
  const avgDiscount = ((rows.filter(r => r.own).reduce((a, r) => a + (r.own / r.base - 1), 0) / overrides) * 100).toFixed(1);

  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="prices" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Үнэ", "Хүнс-Мини"]} actions={
          <div className="ml-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[oklch(0.4_0.13_155)]">
              <span className="size-1.5 rounded-full bg-[oklch(0.55_0.16_155)] animate-pulse" />
              Автомат хадгалагдсан
            </span>
            <button className="h-9 px-3.5 rounded-lg bg-white ring-1 ring-border text-[12.5px] font-semibold hover:bg-muted flex items-center gap-1.5">
              {I.upload} Excel
            </button>
            <button className="h-9 px-3.5 rounded-lg bg-white ring-1 ring-border text-[12.5px] font-semibold hover:bg-muted flex items-center gap-1.5">
              {I.copy} Өөр дэлгүүрээс хуулах
            </button>
          </div>
        } />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[26px] font-bold tracking-tight">Хүнс-Мини</h1>
            <span className="text-[12.5px] text-muted-foreground">үнийн жагсаалт</span>
          </div>

          {/* Summary strip */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <SummaryBox label="Нийт SKU" value="56" />
            <SummaryBox label="Override-той" value={`${overrides}`} tone="primary" />
            <SummaryBox label="Дундаж зөрүү" value={`${avgDiscount}%`} tone="emerald" />
            <SummaryBox label="Default-аар" value={`${56 - overrides}`} />
          </div>

          {/* Tabs */}
          <div className="mt-5 flex items-center gap-2">
            <button className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold">Зөвхөн зөрүү · {overrides}</button>
            <button className="h-8 px-3 rounded-full bg-muted text-muted-foreground ring-1 ring-border text-[12px] font-semibold">Бүгд · 56</button>
            <div className="ml-auto flex items-center gap-2">
              <button className="h-8 px-2.5 rounded-lg bg-white ring-1 ring-border text-[11.5px] font-semibold hover:bg-muted flex items-center gap-1.5">
                ⚡ Бөөнөөр −5%
              </button>
              <button className="h-8 px-2.5 rounded-lg bg-white ring-1 ring-border text-[11.5px] font-semibold hover:bg-muted">↺ Default рүү</button>
            </div>
          </div>

          {/* Table */}
          <div className="mt-3 rounded-2xl bg-white ring-1 ring-border overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2.5">Бараа</th>
                  <th className="text-right px-3 py-2.5 w-32">Жишиг үнэ</th>
                  <th className="text-left px-3 py-2.5 w-48">Энэ дэлгүүрийн үнэ</th>
                  <th className="text-right px-3 py-2.5 w-24">Δ</th>
                  <th className="px-3 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const diff = r.own ? ((r.own / r.base - 1) * 100).toFixed(1) : null;
                  return (
                    <tr key={r.name} className={r.own ? "bg-[color-mix(in_oklch,var(--primary)_3%,white)]" : ""}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg overflow-hidden relative ring-1 ring-border/40 shrink-0">
                            <ProductImage hue={r.hue} dense />
                          </div>
                          <span className="font-semibold">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(r.base)}</td>
                      <td className="px-3 py-3">
                        <div className={`h-9 rounded-lg px-3 flex items-center text-[13px] font-bold tabular-nums w-36 ${
                          r.own ? "bg-white ring-2 ring-primary text-foreground" : "bg-muted ring-1 ring-border text-muted-foreground"
                        }`}>
                          {r.own ? fmt(r.own) : <span className="italic font-normal">default</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {diff ? (
                          <span className="text-[12.5px] font-bold tabular-nums text-[oklch(0.4_0.13_155)]">{diff}%</span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground"><button className="hover:text-foreground">{I.dots}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, tone = "default" }) {
  const colors = {
    default: "text-foreground",
    primary: "text-primary",
    emerald: "text-[oklch(0.4_0.13_155)]",
  };
  return (
    <div className="rounded-2xl bg-white ring-1 ring-border p-4">
      <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-[22px] font-bold tabular-nums tracking-tight ${colors[tone]}`}>{value}</div>
    </div>
  );
}

/* ─────────── Users list ─────────── */
function AdminUsersList() {
  const users = [
    { name: "Б. Мөнхдорж",     role: "admin", phone: "+976 9911 4422", store: "—", last: "Одоо",            tone: "primary" },
    { name: "Ц. Нямсүрэн",     role: "rep",   phone: "+976 9911 4422", store: "5 дэлгүүр", last: "10 мин өмнө", tone: "violet" },
    { name: "Б. Цэрэн",        role: "rep",   phone: "+976 8800 1122", store: "8 дэлгүүр", last: "1 цаг өмнө", tone: "violet" },
    { name: "Б. Энхээ",        role: "buyer", phone: "+976 8811 2233", store: "Хүнс-Мини", last: "1 өдөр өмнө", tone: "sky" },
    { name: "Ц. Нямсүрэн",     role: "buyer", phone: "+976 9911 4422", store: "Номин Их Дэлгүүр", last: "2 өдөр өмнө", tone: "sky" },
    { name: "Б. Долгор",       role: "buyer", phone: "+976 8822 1133", store: "CU Tokyo str.", last: "Хэзээ ч", tone: "sky", inactive: true },
    { name: "Г. Тэмүүлэн",     role: "buyer", phone: "+976 9988 7766", store: "Их Наран",  last: "8 өдрийн өмнө", tone: "sky" },
    { name: "С. Энхтайван",    role: "buyer", phone: "+976 8800 5544", store: "Сансар",    last: "1 цаг өмнө", tone: "sky" },
  ];
  const roleStyles = {
    admin: { l: "Админ", cls: "bg-[color-mix(in_oklch,var(--primary)_12%,white)] text-primary ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]" },
    rep:   { l: "Рөп",   cls: "bg-violet-50 text-violet-700 ring-violet-300/60" },
    buyer: { l: "Худалдан авагч", cls: "bg-sky-50 text-sky-700 ring-sky-300/60" },
  };

  return (
    <div className="h-full flex bg-background overflow-hidden">
      <AdminSidebar active="users" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar crumbs={["Хэрэглэгч"]} actions={
          <button className="ml-3 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-bold flex items-center gap-1.5 shadow-sm">
            {I.plus} Хэрэглэгч урих
          </button>
        } />

        <div className="flex-1 overflow-y-auto p-6">
          <h1 className="text-[26px] font-bold tracking-tight">Хэрэглэгч</h1>
          <p className="text-[13px] text-muted-foreground">Нийт 31 хэрэглэгч</p>

          <div className="mt-4 flex items-center gap-2">
            <button className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold">Бүгд · 31</button>
            <button className="h-8 px-3 rounded-full bg-muted text-muted-foreground ring-1 ring-border text-[12px] font-semibold">Админ · 3</button>
            <button className="h-8 px-3 rounded-full bg-muted text-muted-foreground ring-1 ring-border text-[12px] font-semibold">Рөп · 5</button>
            <button className="h-8 px-3 rounded-full bg-muted text-muted-foreground ring-1 ring-border text-[12px] font-semibold">Худалдан авагч · 23</button>
          </div>

          <div className="mt-4 rounded-2xl bg-white ring-1 ring-border overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2.5">Нэр</th>
                  <th className="text-left px-3 py-2.5 w-32">Үүрэг</th>
                  <th className="text-left px-3 py-2.5 w-40">Утас</th>
                  <th className="text-left px-3 py-2.5">Дэлгүүр</th>
                  <th className="text-left px-3 py-2.5 w-36">Сүүлд нэвтэрсэн</th>
                  <th className="px-3 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u, i) => (
                  <tr key={i} className={`hover:bg-muted/40 ${u.inactive ? "opacity-60" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-gradient-to-br from-[oklch(0.7_0.13_263)] to-primary text-primary-foreground flex items-center justify-center text-[12px] font-bold">
                          {u.name.match(/[А-ЯҮӨ]/)?.[0] || u.name[0]}
                        </div>
                        <span className="font-semibold">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ${roleStyles[u.role].cls}`}>
                        {roleStyles[u.role].l}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono">{u.phone}</td>
                    <td className="px-3 py-3">{u.store}</td>
                    <td className="px-3 py-3 text-muted-foreground">{u.last}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground"><button className="hover:text-foreground">{I.dots}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  AdminLogin, AdminDashboard, AdminOrdersList, AdminOrderDetail,
  AdminProductsList, AdminProductEdit, AdminStoresList, AdminPriceList, AdminUsersList,
});
