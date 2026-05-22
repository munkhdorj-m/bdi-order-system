/* eslint-disable react/prop-types */
/**
 * Buyer hi-fi main screens (Confident language):
 *   - BuyerCatalog (B2)
 *   - BuyerProduct (B3)
 *   - BuyerCart (B4)
 *   - BuyerOrders (B6 list)
 *
 * Pulled out of BDI Buyer Flow · Hi-Fi.html into a shared module so the full
 * system canvas can render them alongside the rest.
 */

const { I, fmt, ProductImage, QtyStepper, AddBtn, StoreHeader, TabBar, Icon, PRODUCTS } = window;

const CART = [
  { ...PRODUCTS[0], qty: 2 },
  { ...PRODUCTS[1], qty: 1 },
  { ...PRODUCTS[5], qty: 3 },
];
const cartTotal = CART.reduce((a, x) => a + x.price * x.qty, 0);

/* ─────────── Catalog (B2) ─────────── */
function ConfidentCard({ p }) {
  const inCart = p.qty > 0;
  return (
    <div className={`group relative flex flex-col rounded-3xl overflow-hidden transition-all ${
      inCart
        ? "bg-[color-mix(in_oklch,var(--primary)_6%,white)] ring-1 ring-[color-mix(in_oklch,var(--primary)_30%,transparent)] shadow-md shadow-[color-mix(in_oklch,var(--primary)_15%,transparent)]"
        : "bg-white ring-1 ring-border"
    }`}>
      <div className="aspect-[4/3.4] relative overflow-hidden">
        <ProductImage hue={p.hue} />
        {p.recent && !p.deal && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 text-[10px] font-bold bg-white/90 backdrop-blur text-foreground px-2 py-0.5 rounded-full ring-1 ring-border">
            {I.history} Сүүлд авсан
          </div>
        )}
        {p.deal && (
          <div className="absolute top-2.5 left-2.5 text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: "var(--chart-coral)" }}>−10%</div>
        )}
        {p.low && (
          <div className="absolute bottom-2.5 left-2.5 text-[10px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full ring-1 ring-amber-300/60">
            Цөөн үлдсэн
          </div>
        )}
      </div>
      <div className="p-3 pt-3 flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-primary">{p.brand}</div>
        <div className="text-[13.5px] font-semibold leading-snug line-clamp-2 min-h-[2.4rem]">{p.name}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[17px] font-bold tabular-nums tracking-tight">{fmt(p.price)}</span>
          {p.deal && <span className="text-[11px] text-muted-foreground line-through">{fmt(Math.round(p.price / 0.9))}</span>}
        </div>
        {p.box && <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">{I.package} хайрцагт {p.box}ш</div>}
        <div className="mt-1">{inCart ? <QtyStepper qty={p.qty} large /> : <AddBtn />}</div>
      </div>
    </div>
  );
}

function CategoryRail({ items, activeIdx = 0 }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
      {items.map((it, i) => {
        const a = i === activeIdx;
        return (
          <div key={i} className="snap-start shrink-0 w-[58px] flex flex-col items-center gap-1 select-none">
            <div className={`size-11 rounded-xl flex items-center justify-center transition-all ${
              a ? "bg-primary text-primary-foreground ring-1 ring-[color-mix(in_oklch,var(--primary)_40%,transparent)] shadow-sm"
                : "bg-muted text-foreground/70 ring-1 ring-border"
            }`}>{it.icon}</div>
            <span className={`text-[10px] leading-tight text-center font-medium ${a ? "text-foreground" : "text-muted-foreground"}`}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const CATS = [
  { icon: I.bag, label: "Бүгд" },
  { icon: <Icon d={<path d="M3 12h18M3 6h18M3 18h18" />} size={18} />, label: "Цаас" },
  { icon: <Icon d={<><circle cx="12" cy="12" r="6" /></>} size={18} />, label: "Хөвөн" },
  { icon: <Icon d={<path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9-9-4-9-9z" />} size={18} />, label: "Угаалга" },
  { icon: <Icon d={<><path d="M12 2v20M2 12h20" /></>} size={18} />, label: "Ариут." },
];

function BuyerCatalog() {
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <StoreHeader title="Хүнс-Мини" />
      <div className="px-3 pt-3">
        <button className="w-full h-11 rounded-2xl bg-muted/80 ring-1 ring-border flex items-center gap-2 px-4 text-[13px] text-muted-foreground">
          {I.search} Барааны нэр, бренд…
        </button>
      </div>
      <div className="px-3 pt-3 pb-1 border-b border-border/40">
        <CategoryRail items={CATS} activeIdx={0} />
      </div>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <p className="text-[13px]"><span className="font-bold tabular-nums">48</span><span className="text-muted-foreground"> бараа</span></p>
        <button className="text-[12px] text-muted-foreground flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted">{I.filter} Үнэ ↓</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-3">
          {PRODUCTS.slice(0, 6).map((p, i) => <ConfidentCard key={i} p={p} />)}
        </div>
      </div>
      <TabBar active="catalog" cartCount={6} />
    </div>
  );
}

/* ─────────── Product (B3) ─────────── */
function BuyerProduct() {
  const p = { brand: "Soft Leaf", name: "Ариутгалын нойтон салфетка 10ш", price: 1220, sku: "4890326012629", box: 120, hue: 165, qty: 2, stock: 48, history: 8 };
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <StoreHeader back title="Бүтээгдэхүүн" />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-3 pt-3">
          <div className="aspect-[5/4] rounded-3xl overflow-hidden relative ring-1 ring-border">
            <ProductImage hue={p.hue} />
            <div className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold bg-white/90 backdrop-blur text-foreground px-2 py-1 rounded-full ring-1 ring-border">
              {I.history} Сүүлд: 4 өдрийн өмнө
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {[p.hue, p.hue + 20, p.hue - 30].map((h, i) => (
              <div key={i} className={`size-12 rounded-xl overflow-hidden relative ring-1 ${i === 0 ? "ring-2 ring-primary" : "ring-border"}`}>
                <ProductImage hue={h} dense />
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 pt-4">
          <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-primary">{p.brand}</div>
          <h1 className="text-[20px] font-bold leading-tight tracking-tight mt-1">{p.name}</h1>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-[26px] font-bold tabular-nums tracking-tight">{fmt(p.price)}</span>
            <span className="text-[12px] text-muted-foreground">/ уут</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[12px] flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color-mix(in_oklch,var(--chart-emerald)_15%,white)] text-[oklch(0.4_0.13_155)] ring-1 ring-[color-mix(in_oklch,var(--chart-emerald)_30%,transparent)] font-semibold">
              <span className="size-1.5 rounded-full" style={{ background: "var(--chart-emerald)" }} />
              Үлдэгдэл: {p.stock}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              {I.package} Хайрцагт {p.box}ш
            </span>
          </div>
        </div>
        <div className="mx-4 mt-5 rounded-2xl ring-1 ring-border bg-accent/40 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Таны түүх</div>
            <div className="text-[11px] font-semibold text-primary">Бүгд ›</div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[18px] font-bold tabular-nums">{p.history}</span>
            <span className="text-[12.5px] text-muted-foreground">удаа авсан · ~сард 10ш</span>
          </div>
          <div className="mt-2.5 flex items-end gap-1 h-7">
            {[14, 28, 18, 22, 10, 32, 24].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: h, background: i === 5 ? "var(--primary)" : "color-mix(in oklch, var(--primary) 22%, transparent)" }} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-5">
          <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Тайлбар</div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-foreground/85">
            Нян бактерийн 99.9%-ийг устгадаг, гар болон бараа ариутгахад зориулсан нойтон салфетка. Найрлагад этанол агуулна. SKU: {p.sku}.
          </p>
        </div>
      </div>
      <div className="border-t border-border bg-background/95 backdrop-blur px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex bg-muted rounded-full p-1 text-sm font-medium flex-1">
            <div className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm" />
            <button className="relative z-10 flex-1 py-1.5 text-[12px] font-semibold text-foreground">Ширхэг</button>
            <button className="relative z-10 flex-1 py-1.5 text-[12px] font-semibold text-muted-foreground flex items-center justify-center gap-1.5">
              {I.package} Хайрцаг
            </button>
          </div>
        </div>
        <div className="flex items-stretch gap-2">
          <div className="h-12 inline-flex items-stretch rounded-2xl border-2 border-border bg-white overflow-hidden">
            <button className="px-3.5 hover:bg-muted">{I.minus}</button>
            <span className="px-3.5 flex items-center font-bold tabular-nums text-[15px] min-w-12 justify-center">{p.qty}</span>
            <button className="px-3.5 hover:bg-muted">{I.plus}</button>
          </div>
          <button className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] transition-all">
            <span>Сагсанд нэмэх</span>
            <span className="text-primary-foreground/85 tabular-nums">· {fmt(p.price * p.qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Cart (B4) ─────────── */
function CartLine({ p }) {
  return (
    <div className="flex gap-3 p-3 rounded-2xl bg-white ring-1 ring-border">
      <div className="size-20 rounded-2xl overflow-hidden relative shrink-0 ring-1 ring-border/40">
        <ProductImage hue={p.hue} dense />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-primary">{p.brand}</div>
        <div className="text-[13px] font-semibold leading-snug line-clamp-2">{p.name}</div>
        <div className="mt-1.5 text-[11.5px] text-muted-foreground tabular-nums">
          {fmt(p.price)} × {p.qty} = <span className="font-bold text-foreground">{fmt(p.price * p.qty)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-muted ring-1 ring-border">
            <button className="size-7 flex items-center justify-center hover:bg-[oklch(0.94_0.005_264)] rounded-l-full">{I.minus}</button>
            <span className="px-2 text-[12.5px] font-bold tabular-nums min-w-7 text-center">{p.qty}</span>
            <button className="size-7 flex items-center justify-center hover:bg-[oklch(0.94_0.005_264)] rounded-r-full">{I.plus}</button>
          </div>
          <button className="ml-auto size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600">{I.trash}</button>
        </div>
      </div>
    </div>
  );
}

function BuyerCart() {
  const total = cartTotal;
  const qty = CART.reduce((a, x) => a + x.qty, 0);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <StoreHeader back title="Сагс" />
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[20px] font-bold tracking-tight">Миний сагс</h1>
          <span className="text-[12.5px] text-muted-foreground tabular-nums">{qty} ширхэг бараа</span>
        </div>

        <div className="mt-3 rounded-2xl ring-1 ring-border bg-accent/40 p-3 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-white ring-1 ring-border flex items-center justify-center text-primary">
            {I.truck}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Хүргэлт</div>
            <div className="text-[12.5px] font-semibold">Маргааш · 09:00 — 11:00</div>
          </div>
          <button className="text-[11px] font-semibold text-primary">Өөрчлөх</button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {CART.map((p) => <CartLine key={p.id} p={p} />)}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {I.spark}
              <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Хамт авдаг</span>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3">
            {PRODUCTS.slice(2, 6).map((p) => (
              <div key={p.id} className="shrink-0 w-[120px] rounded-2xl ring-1 ring-border bg-white p-2">
                <div className="aspect-square rounded-xl overflow-hidden relative">
                  <ProductImage hue={p.hue} dense />
                </div>
                <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-primary mt-1.5 truncate">{p.brand}</div>
                <div className="text-[11px] font-semibold leading-tight line-clamp-2 h-[2.2em] mt-0.5">{p.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[12px] font-bold tabular-nums">{fmt(p.price)}</span>
                  <button className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">{I.plus}</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-2">
            {I.note} Тэмдэглэл (заавал биш)
          </label>
          <div className="rounded-2xl bg-muted/60 ring-1 ring-border px-4 py-3 text-[13px] text-muted-foreground">
            Жш: Маргааш 10 цаг хүртэл хүргэх боломжтой бол хүргэнэ үү
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-background/95 backdrop-blur px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="flex items-baseline justify-between mb-2 px-1">
          <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Нийт</span>
          <span className="text-[22px] font-bold tabular-nums tracking-tight">{fmt(total)}</span>
        </div>
        <button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] transition-all">
          Захиалга илгээх <span className="opacity-80">{I.chevR}</span>
        </button>
      </div>
    </div>
  );
}

/* ─────────── Orders list (B6) ─────────── */
const ORDERS_BUYER = [
  { n: "ORD-2026-00042", d: "5/11 · 14:32", items: 3, total: 4690,  status: "pending",   step: 1, eta: "Маргааш 09:00 — 11:00" },
  { n: "ORD-2026-00040", d: "5/10 · 11:08", items: 5, total: 27400, status: "packing",   step: 2, eta: "Өнөөдөр илгээнэ" },
  { n: "ORD-2026-00038", d: "5/08 · 16:20", items: 4, total: 12300, status: "delivered", step: 4, eta: "5/09-нд хүргэгдсэн" },
  { n: "ORD-2026-00033", d: "5/05 · 09:15", items: 6, total: 8150,  status: "delivered", step: 4, eta: "5/06-нд хүргэгдсэн" },
];

function ProgressBar({ step }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex-1 h-1 rounded-full" style={{
          background: s <= step ? "var(--primary)" : "color-mix(in oklch, var(--primary) 14%, var(--muted))",
        }} />
      ))}
    </div>
  );
}

function OrderCard({ o, expanded = false }) {
  const { StatusPill } = window;
  return (
    <div className={`rounded-3xl bg-white ring-1 ring-border overflow-hidden transition-all ${expanded ? "shadow-md shadow-[color-mix(in_oklch,var(--primary)_15%,transparent)] ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]" : ""}`}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">Захиалга</div>
            <div className="text-[14px] font-bold tracking-tight font-mono">{o.n}</div>
          </div>
          <StatusPill status={o.status} />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>{o.d} · {o.items} бараа</span>
          <span className="text-[15px] font-bold text-foreground tabular-nums">{fmt(o.total)}</span>
        </div>
        <div className="mt-3"><ProgressBar step={o.step} /></div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {o.status === "delivered" ? I.check : I.clock}<span>{o.eta}</span>
        </div>
        {expanded && (
          <div className="mt-3.5 pt-3.5 border-t border-border/60 flex gap-2">
            <button className="flex-1 h-9 rounded-xl text-[12px] font-semibold border border-border bg-white hover:bg-muted flex items-center justify-center gap-1.5">
              Дэлгэрэнгүй
            </button>
            <button className="flex-1 h-9 rounded-xl text-[12px] font-bold bg-primary text-primary-foreground flex items-center justify-center gap-1.5 shadow-sm">
              {I.cart} Дахин захиалах
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BuyerOrders() {
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <StoreHeader title="Хүнс-Мини" />
      <div className="px-3 pt-3">
        <h1 className="text-[22px] font-bold tracking-tight">Захиалгууд</h1>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { l: "Идэвхтэй · 2", a: true },
            { l: "Хүргэгдсэн" },
            { l: "Бүгд" },
          ].map((t, i) => (
            <button key={i} className={`shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-semibold transition-all ${
              t.a ? "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
                  : "bg-muted text-muted-foreground ring-1 ring-border hover:bg-[oklch(0.95_0.005_264)]"
            }`}>{t.l}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3 flex flex-col gap-2.5">
        <OrderCard o={ORDERS_BUYER[0]} expanded />
        <OrderCard o={ORDERS_BUYER[1]} />
        <div className="mt-3 mb-1 text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground px-1">
          Хүргэгдсэн
        </div>
        <OrderCard o={ORDERS_BUYER[2]} />
        <OrderCard o={ORDERS_BUYER[3]} />
      </div>
      <TabBar active="orders" cartCount={6} />
    </div>
  );
}

Object.assign(window, { BuyerCatalog, BuyerProduct, BuyerCart, BuyerOrders });
