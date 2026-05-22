/* eslint-disable react/prop-types */
/**
 * Rep hi-fi mobile screens:
 *   - RepStoresList (R1) — "my stores" with cadence signals
 *   - RepStoreDetail (R2) — store overview + "order on behalf" entry
 *   - RepCatalog (R3) — context banner + catalog for ordering on behalf
 */

const { I, fmt, ProductImage, QtyStepper, AddBtn, StoreHeader, RepTabBar, STORES, PRODUCTS, Icon } = window;

/* ─────────── R1: Stores list ─────────── */
function RepStoresList() {
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Branded header */}
      <header className="relative" style={{
        background: "linear-gradient(160deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 80%, black) 100%)",
      }}>
        <div className="px-4 pt-14 pb-4 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center font-bold text-[13px]">
              ЦН
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-80 font-semibold">Төлөөлөгч</div>
              <div className="text-[14px] font-bold truncate">Ц. Нямсүрэн</div>
            </div>
            <button className="size-9 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
              {I.bell}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-3 py-2">
              <div className="text-[18px] font-bold tabular-nums leading-tight">8</div>
              <div className="text-[10px] opacity-85">Хариуцлагатай</div>
            </div>
            <div className="rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-3 py-2">
              <div className="text-[18px] font-bold tabular-nums leading-tight">12</div>
              <div className="text-[10px] opacity-85">Энэ сард</div>
            </div>
            <div className="rounded-xl bg-amber-400/30 ring-1 ring-amber-200/40 backdrop-blur px-3 py-2">
              <div className="text-[18px] font-bold tabular-nums leading-tight">2</div>
              <div className="text-[10px] opacity-90">⚠ Анхаарах</div>
            </div>
          </div>
        </div>
        <div className="h-4 bg-background rounded-t-3xl" />
      </header>

      {/* Search */}
      <div className="px-3 pt-3">
        <button className="w-full h-11 rounded-2xl bg-muted/80 ring-1 ring-border flex items-center gap-2 px-4 text-[13px] text-muted-foreground">
          {I.search} Дэлгүүрийн нэрээр хайх…
        </button>
      </div>

      {/* Filter chips */}
      <div className="px-3 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button className="shrink-0 h-9 px-3 rounded-full bg-amber-100 text-amber-900 ring-1 ring-amber-300/60 text-[12px] font-bold flex items-center gap-1.5">
            ⚠ Анхаарах · 2
          </button>
          <button className="shrink-0 h-9 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-bold">Бүгд · 8</button>
          <button className="shrink-0 h-9 px-3 rounded-full bg-muted text-muted-foreground ring-1 ring-border text-[12px] font-semibold flex items-center gap-1">
            {I.map} Ойролцоо
          </button>
        </div>
      </div>

      {/* Store list */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3 flex flex-col gap-2">
        {STORES.map((s) => {
          const isHot = s.status === "hot";
          const isWarn = s.status === "warn";
          return (
            <div key={s.name} className={`rounded-2xl bg-white p-3.5 flex items-center gap-3 ring-1 transition-all ${
              isWarn ? "ring-amber-300/60 shadow-sm shadow-amber-100" : "ring-border"
            }`}>
              <div className="relative">
                <div className={`size-11 rounded-2xl flex items-center justify-center font-bold text-[15px] shrink-0 ${
                  isHot
                    ? "bg-gradient-to-br from-[oklch(0.66_0.14_155)] to-[oklch(0.52_0.16_155)] text-white"
                    : isWarn
                      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300/60"
                      : "bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground"
                }`}>
                  {s.name[0]}
                </div>
                {isHot && <span className="absolute -top-1 -right-1 text-[11px]">{I.flame}</span>}
              </div>

              <div className="flex-1 min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-bold truncate">{s.name}</span>
                  {isWarn && <span className="text-amber-700">{I.warn}</span>}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{s.mgr} · {s.phone}</div>
                <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${isWarn ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
                  {I.clock}<span>{s.last}</span>
                </div>
              </div>

              <button className="size-9 rounded-xl text-primary bg-[color-mix(in_oklch,var(--primary)_8%,white)] ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)] flex items-center justify-center shrink-0">
                {I.chevR}
              </button>
            </div>
          );
        })}
      </div>

      <RepTabBar active="stores" />
    </div>
  );
}

/* ─────────── R2: Store detail ─────────── */
function RepStoreDetail() {
  const store = STORES[0];
  const lastOrders = [
    { n: "ORD-…42", d: "5/11", t: 4690,  status: "pending"   },
    { n: "ORD-…35", d: "5/03", t: 9400,  status: "delivered" },
    { n: "ORD-…28", d: "4/26", t: 7200,  status: "delivered" },
  ];

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <StoreHeader back title={store.name} sub="Дэлгүүр" />

      <div className="flex-1 overflow-y-auto pb-3">
        {/* Hero */}
        <div className="px-4 pt-3">
          <div className="rounded-3xl ring-1 ring-border bg-gradient-to-br from-[color-mix(in_oklch,var(--primary)_5%,white)] to-white p-4">
            <div className="flex items-start gap-3">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground flex items-center justify-center font-bold text-[18px] shrink-0">
                {store.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-[18px] font-bold tracking-tight">{store.name}</h1>
                <p className="text-[12px] text-muted-foreground">Энгүүн дүүрэг · 5-р хороо</p>
              </div>
              <button className="size-10 rounded-xl bg-white ring-1 ring-border text-primary flex items-center justify-center">
                {I.phone}
              </button>
            </div>

            {/* Contact card */}
            <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{I.user}</span>
                <span className="font-semibold">{store.mgr}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{I.phone}</span>
                <span className="font-mono">{store.phone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="px-3 mt-3">
          <button className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98]">
            {I.plus} Захиалга үүсгэх · нэрийн өмнөөс
          </button>
        </div>

        {/* Stats */}
        <div className="px-4 mt-5 grid grid-cols-3 gap-2">
          {[
            { l: "Энэ сард",  v: "12",     sub: "захиалга" },
            { l: "Дундаж",    v: "8.4K ₮", sub: "захиалга" },
            { l: "Давтамж",   v: "7 өдөр", sub: "тутамд" },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl bg-white ring-1 ring-border p-3 text-center">
              <div className="text-[16px] font-bold tabular-nums tracking-tight">{s.v}</div>
              <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground mt-0.5">{s.l}</div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div className="px-3 mt-5">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Сүүлийн захиалга</div>
            <button className="text-[11.5px] font-semibold text-primary">Бүгд ›</button>
          </div>
          <div className="flex flex-col gap-2">
            {lastOrders.map((o) => (
              <div key={o.n} className="rounded-2xl bg-white ring-1 ring-border p-3 flex items-center gap-3">
                <div className={`size-2 rounded-full ${
                  o.status === "delivered" ? "bg-[oklch(0.66_0.14_155)]" : "bg-amber-500"
                }`} />
                <div className="flex-1 leading-tight">
                  <div className="text-[12.5px] font-semibold font-mono">{o.n}</div>
                  <div className="text-[10.5px] text-muted-foreground">{o.d}</div>
                </div>
                <div className="text-[13px] font-bold tabular-nums">{fmt(o.t)}</div>
                <span className="text-muted-foreground">{I.chevR}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── R3: Order on behalf catalog ─────────── */
function RepCatalog() {
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl">
        <div className="h-14 flex items-center px-3 gap-2">
          <button className="-ml-1 size-9 rounded-xl flex items-center justify-center bg-muted ring-1 ring-border">{I.back}</button>
          <div className="leading-tight">
            <div className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Буцах</div>
            <div className="text-[13px] font-semibold">Каталог</div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted">{I.search}</button>
          </div>
        </div>
      </header>

      {/* Persistent context banner — the R3 critical UX */}
      <div className="mx-3 mt-1 rounded-2xl ring-2 ring-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 flex items-center gap-3 shadow-sm">
        <div className="size-10 rounded-xl bg-white ring-1 ring-amber-300/60 flex items-center justify-center text-amber-700 shrink-0">
          <Icon d={<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>} size={18} />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[9.5px] uppercase tracking-[0.12em] font-bold text-amber-900/80">Нэрийн өмнөөс захиалж байна</div>
          <div className="text-[13.5px] font-bold text-amber-950">Хүнс-Мини · Б. Энхээ</div>
          <div className="text-[10.5px] text-amber-900/80">Үнэ нь тус дэлгүүрийн override-ийн дагуу харуулагдаж байна</div>
        </div>
        <button className="text-[11.5px] font-bold text-amber-900 underline shrink-0">Солих</button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <button className="w-full h-10 rounded-xl bg-muted/80 ring-1 ring-border flex items-center gap-2 px-3.5 text-[12.5px] text-muted-foreground">
          {I.search} Хайх…
        </button>
      </div>

      {/* Compact grid */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3">
        <div className="grid grid-cols-2 gap-2.5">
          {PRODUCTS.slice(0, 6).map((p) => {
            const storePrice = Math.round(p.price * (p.id === "p1" ? 0.967 : p.id === "p3" ? 0.953 : p.id === "p5" ? 0.955 : 1));
            const hasOverride = storePrice !== p.price;
            const inCart = p.qty > 0;
            return (
              <div key={p.id} className={`flex flex-col rounded-2xl overflow-hidden transition-all ${
                inCart
                  ? "bg-[color-mix(in_oklch,var(--primary)_5%,white)] ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
                  : "bg-white ring-1 ring-border"
              }`}>
                <div className="aspect-square relative overflow-hidden">
                  <ProductImage hue={p.hue} dense />
                  {hasOverride && (
                    <div className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-white text-primary px-1.5 py-0.5 rounded-full ring-1 ring-[color-mix(in_oklch,var(--primary)_25%,transparent)]">
                      Тусгай үнэ
                    </div>
                  )}
                </div>
                <div className="p-2.5 flex flex-col gap-0.5">
                  <div className="text-[9px] uppercase tracking-[0.08em] font-bold text-primary truncate">{p.brand}</div>
                  <div className="text-[11.5px] font-semibold leading-tight line-clamp-2 h-[2.2em]">{p.name}</div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-[13px] font-bold tabular-nums">{fmt(storePrice)}</span>
                    {hasOverride && <span className="text-[10px] text-muted-foreground line-through tabular-nums">{fmt(p.price)}</span>}
                  </div>
                </div>
                <div className="px-2.5 pb-2.5">
                  {inCart ? <QtyStepper qty={p.qty} /> : <AddBtn />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky cart submit */}
      <div className="border-t border-border bg-background px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[13.5px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98]">
          <span className="flex items-center gap-2">{I.cart} 3 бараа</span>
          <span className="opacity-60">·</span>
          <span className="tabular-nums">{fmt(4690)}</span>
          <span className="opacity-80 ml-auto">{I.chevR}</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { RepStoresList, RepStoreDetail, RepCatalog });
