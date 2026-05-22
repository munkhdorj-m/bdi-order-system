/* eslint-disable react/prop-types */
/**
 * Shared hi-fi primitives for the BDI system.
 * Uses production tokens: indigo `oklch(0.5 0.18 263)`, Geist, shadcn radii.
 *
 * Exposes via `window`:
 *   Icon, I (icon set), fmt, ProductImage, QtyStepper, AddBtn,
 *   StoreHeader, TabBar, AdminSidebar, Pill, Badge, Statbox
 */

const Icon = ({ d, size = 20, sw = 2, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {d}
  </svg>
);

const I = {
  search:   <Icon d={<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>} />,
  cart:     <Icon d={<><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></>} />,
  plus:     <Icon d={<path d="M12 5v14M5 12h14" />} />,
  minus:    <Icon d={<path d="M5 12h14" />} />,
  back:     <Icon d={<path d="m15 18-6-6 6-6" />} sw={2.2} />,
  bag:      <Icon d={<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>} />,
  clip:     <Icon d={<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>} />,
  chevR:    <Icon d={<path d="m9 18 6-6-6-6" />} sw={2.4} size={16} />,
  chevD:    <Icon d={<path d="m6 9 6 6 6-6" />} sw={2.2} size={14} />,
  history:  <Icon d={<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>} size={12} sw={2.2} />,
  package:  <Icon d={<><path d="m12 3 9 4.5v9L12 21l-9-4.5v-9z" /><path d="M3.3 7 12 12l8.7-5M12 12v9" /></>} size={12} />,
  filter:   <Icon d={<path d="M3 6h18M7 12h10M11 18h2" />} />,
  trash:    <Icon d={<><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></>} size={16} sw={2.2} />,
  note:     <Icon d={<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h6M8 17h4" /></>} size={14} />,
  check:    <Icon d={<path d="M5 12l5 5L20 7" />} sw={2.6} />,
  truck:    <Icon d={<><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>} size={14} />,
  clock:    <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} size={14} />,
  spark:    <Icon d={<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />} sw={2} size={14} />,
  phone:    <Icon d={<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.08.72 3.07a2 2 0 0 1-.45 2.11L8.09 10.91a16 16 0 0 0 6 6l2-1.27a2 2 0 0 1 2.11-.45c1 .35 2.02.59 3.07.72A2 2 0 0 1 22 16.92Z" />} />,
  store:    <Icon d={<><path d="M3 9V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3l-2 4-2-4-2 4-2-4-2 4-2-4-2 4-2-4Z" /><path d="M4 13v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /></>} />,
  bell:     <Icon d={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>} />,
  user:     <Icon d={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>} />,
  users:    <Icon d={<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M18 21c0-3-1.7-5.5-4-6.6" /></>} />,
  edit:     <Icon d={<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />} size={14} sw={2.2} />,
  arrowR:   <Icon d={<path d="M5 12h14M13 5l7 7-7 7" />} size={14} sw={2.2} />,
  copy:     <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} size={14} />,
  upload:   <Icon d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>} size={14} />,
  receipt:  <Icon d={<><path d="M4 2h16v20l-4-2-4 2-4-2-4 2z" /><path d="M8 7h8M8 11h8M8 15h5" /></>} size={14} />,
  dots:     <Icon d={<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>} sw={3} />,
  home:     <Icon d={<path d="M3 12 12 3l9 9M5 10v10h14V10" />} />,
  cash:     <Icon d={<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>} />,
  map:      <Icon d={<><path d="M9 5 3 7v14l6-2 6 2 6-2V5l-6 2-6-2Z" /><path d="M9 5v14M15 7v14" /></>} size={14} />,
  warn:     <Icon d={<><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>} size={14} />,
  flame:    <Icon d={<path d="M8.5 14.5C6 12 6 9 8.5 6.5c1 1.5 1.5 3 1.5 3s.5-2 2-3.5c.5 1 .5 2 .5 2s2-1.5 3 0c2 2.5 0 6.5-3 9-1.5 1-3 0-4.5-1.5z" />} size={14} sw={2} />,
};

const fmt = (n) => n.toLocaleString("mn-MN") + "₮";

function ProductImage({ hue, dense = false }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center"
      style={{ background: `radial-gradient(circle at 35% 30%, oklch(0.94 0.04 ${hue}) 0%, oklch(0.88 0.05 ${hue}) 50%, oklch(0.82 0.06 ${hue}) 100%)` }}
    >
      <div className="rounded-2xl shadow-md"
        style={{
          width: dense ? "44%" : "52%",
          height: dense ? "62%" : "70%",
          background: `linear-gradient(160deg, oklch(0.55 0.13 ${hue}), oklch(0.4 0.15 ${hue}))`,
          boxShadow: `0 10px 20px -8px oklch(0.4 0.15 ${hue} / 0.5)`,
        }}
      />
    </div>
  );
}

function QtyStepper({ qty, large = false }) {
  return (
    <div className="flex items-stretch rounded-lg overflow-hidden text-primary-foreground"
      style={{
        background: "var(--primary)",
        height: large ? 40 : 32,
        boxShadow: "0 1px 0 0 color-mix(in oklch, var(--primary) 30%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--primary) 30%, transparent)",
      }}
    >
      <button className="px-2.5 hover:bg-black/15 active:scale-95 transition-all">{I.minus}</button>
      <span className={`flex items-center justify-center font-bold tabular-nums ${large ? "text-base px-3 min-w-12" : "text-sm px-2 min-w-10"}`}>{qty}</span>
      <button className="px-2.5 hover:bg-black/15 active:scale-95 transition-all">{I.plus}</button>
    </div>
  );
}

function AddBtn() {
  return (
    <button className="w-full h-10 rounded-lg text-xs font-semibold border border-border bg-white hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.97] transition-all flex items-center justify-center gap-1.5">
      <span className="text-primary">{I.plus}</span> Нэмэх
    </button>
  );
}

function StoreHeader({ back, title, sub = "Дэлгүүр" }) {
  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl">
      <div className="h-14 flex items-center px-3 gap-2">
        {back ? (
          <button className="-ml-1 size-9 rounded-xl flex items-center justify-center bg-muted hover:bg-[oklch(0.94_0.005_264)] ring-1 ring-border">{I.back}</button>
        ) : (
          <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">Х</div>
        )}
        <div className="flex flex-col items-start min-w-0 leading-tight">
          <span className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">{back ? "Буцах" : sub}</span>
          <span className="text-[13px] font-semibold truncate">{title}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted">{I.search}</button>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklch,var(--primary)_30%,transparent)] to-transparent" />
    </header>
  );
}

function TabBar({ active = "catalog", cartCount = 3 }) {
  const tabs = [
    { k: "catalog", i: I.bag, l: "Каталог" },
    { k: "orders", i: I.clip, l: "Захиалга" },
    { k: "cart", i: I.cart, l: "Сагс", badge: cartCount },
  ];
  return (
    <nav className="border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="flex min-h-14 max-w-lg mx-auto">
        {tabs.map((t) => {
          const a = t.k === active;
          return (
            <li key={t.k} className="flex-1">
              <a className={`flex flex-col items-center justify-center h-full gap-1 py-2 ${a ? "text-primary" : "text-muted-foreground"}`}>
                <div className="relative">{t.i}
                  {t.badge && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10.5px] font-medium leading-none">{t.l}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function RepTabBar({ active = "stores" }) {
  const tabs = [
    { k: "stores", i: I.store, l: "Дэлгүүр" },
    { k: "orders", i: I.clip, l: "Захиалга" },
    { k: "stats", i: <Icon d={<><path d="M3 21V3M3 21h18M7 14v3M12 9v8M17 5v12" /></>} />, l: "Үзүүлэлт" },
    { k: "profile", i: I.user, l: "Профайл" },
  ];
  return (
    <nav className="border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="flex min-h-14 max-w-lg mx-auto">
        {tabs.map((t) => {
          const a = t.k === active;
          return (
            <li key={t.k} className="flex-1">
              <a className={`flex flex-col items-center justify-center h-full gap-1 py-2 ${a ? "text-primary" : "text-muted-foreground"}`}>
                {t.i}
                <span className="text-[10.5px] font-medium leading-none">{t.l}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Admin sidebar — left rail, persistent, matches shadcn density */
function AdminSidebar({ active = "dashboard", user = "Б. Мөнхдорж" }) {
  const items = [
    { k: "dashboard", l: "Дашбоард", icon: I.home },
    { k: "orders",    l: "Захиалга", icon: I.clip, badge: 12 },
    { k: "products",  l: "Бараа",    icon: I.bag },
    { k: "stores",    l: "Дэлгүүр",  icon: I.store },
    { k: "prices",    l: "Үнэ",      icon: I.cash },
    { k: "users",     l: "Хэрэглэгч",icon: I.users },
  ];
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-[oklch(0.985_0.004_264)] flex flex-col">
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-border">
        <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.42_0.18_263)] text-primary-foreground flex items-center justify-center font-bold text-[12px] shadow-sm">BDI</div>
        <div className="leading-tight">
          <div className="text-[12px] font-bold">BDI Admin</div>
          <div className="text-[9.5px] text-muted-foreground">Захиалгын систем</div>
        </div>
      </div>
      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        {items.map((it) => {
          const a = it.k === active;
          return (
            <a key={it.k}
              className={`group flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-all ${
                a ? "bg-primary text-primary-foreground shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className={a ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}>{it.icon}</span>
              <span>{it.l}</span>
              {it.badge && (
                <span className={`ml-auto text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                  a ? "bg-white/25 text-primary-foreground" : "bg-amber-100 text-amber-900 ring-1 ring-amber-300/60"
                }`}>{it.badge}</span>
              )}
            </a>
          );
        })}
      </nav>
      <div className="p-2 border-t border-border">
        <div className="flex items-center gap-2 px-2.5 h-10 rounded-lg hover:bg-muted">
          <div className="size-7 rounded-full bg-gradient-to-br from-[oklch(0.7_0.13_263)] to-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">
            М
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold truncate">{user}</div>
            <div className="text-[10px] text-muted-foreground">Админ</div>
          </div>
          {I.dots}
        </div>
      </div>
    </aside>
  );
}

/* Admin topbar with breadcrumb + search + actions */
function AdminTopbar({ crumbs = [], search = true, actions = null }) {
  return (
    <header className="h-14 border-b border-border bg-background/85 backdrop-blur flex items-center px-5 gap-3">
      <div className="flex items-center gap-1.5 text-[13px] min-w-0">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <span className={i === crumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>{c}</span>
            {i < crumbs.length - 1 && <span className="text-muted-foreground/50">/</span>}
          </React.Fragment>
        ))}
      </div>
      {search && (
        <div className="ml-auto flex items-center gap-2">
          <button className="h-9 px-3 rounded-lg bg-muted ring-1 ring-border text-[12.5px] text-muted-foreground flex items-center gap-2 hover:bg-[oklch(0.95_0.005_264)] min-w-[240px]">
            {I.search}
            <span>Бүх зүйлээс хайх…</span>
            <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-white ring-1 ring-border">⌘K</kbd>
          </button>
          <button className="size-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground relative">
            {I.bell}
            <span className="absolute top-1.5 right-2 size-2 rounded-full bg-red-500 ring-2 ring-background" />
          </button>
        </div>
      )}
      {!search && <div className="ml-auto" />}
      {actions}
    </header>
  );
}

function StatusPill({ status }) {
  const map = {
    pending:   { label: "Хүлээгдэж буй", cls: "bg-amber-50 text-amber-900 ring-amber-300/60", dot: "var(--chart-amber)" },
    confirmed: { label: "Баталгаажсан",  cls: "bg-[color-mix(in_oklch,var(--primary)_10%,white)] text-primary ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]", dot: "var(--primary)" },
    packing:   { label: "Багцлаж буй",   cls: "bg-[color-mix(in_oklch,var(--primary)_10%,white)] text-primary ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]", dot: "var(--primary)" },
    shipped:   { label: "Илгээсэн",      cls: "bg-[color-mix(in_oklch,var(--primary)_10%,white)] text-primary ring-[color-mix(in_oklch,var(--primary)_30%,transparent)]", dot: "var(--primary)" },
    delivered: { label: "Хүргэгдсэн",    cls: "bg-[color-mix(in_oklch,var(--chart-emerald)_12%,white)] text-[oklch(0.4_0.13_155)] ring-[color-mix(in_oklch,var(--chart-emerald)_30%,transparent)]", dot: "var(--chart-emerald)" },
    cancelled: { label: "Цуцалсан",      cls: "bg-muted text-muted-foreground ring-border", dot: "oklch(0.6 0.02 264)" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${s.cls}`}>
      <span className="size-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

/* Standard hi-fi product list */
const PRODUCTS = [
  { id: "p1", brand: "Soft Leaf", name: "Ариутгалын нойтон салфетка 10ш",   price: 1220, box: 120, qty: 2, recent: true,  hue: 165, stock: 48 },
  { id: "p2", brand: "Soft Leaf", name: "Нойтон салфетка 25ш тагтай",       price: 2250, box:  48, qty: 1, recent: true,  hue: 140, stock: 22 },
  { id: "p3", brand: "Cleanly",   name: "Хөвөн дэвсгэр 50ш багц",            price: 2150, box:  24, qty: 0, recent: false, hue: 215, stock: 6, low: true },
  { id: "p4", brand: "Persil",    name: "Угаалгын нунтаг 1кг автомат",       price: 8400, box:   8, qty: 0, deal: -10,    hue: 200, stock: 0, out: true },
  { id: "p5", brand: "Dettol",    name: "Ариутгалын шингэн 500мл",           price: 5650, box:  12, qty: 0,               hue: 25,  stock: 14 },
  { id: "p6", brand: "Lavera",    name: "Шингэн саван 750мл насос",          price: 3900, box:  12, qty: 0, recent: true, hue: 50,  stock: 28 },
  { id: "p7", brand: "Cleanly",   name: "Гарын саван хатамал",                price: 1850, box:  20, qty: 0,               hue: 280, stock: 33 },
  { id: "p8", brand: "Soft Leaf", name: "Гар алчуур 100ш",                    price: 4100, box:  20, qty: 0,               hue: 120, stock: 17 },
];

const STORES = [
  { name: "Хүнс-Мини",       mgr: "Б. Энхээ",      phone: "+976 8811 2233", last: "2 өдрийн өмнө · 4,690₮",   visits: 12, status: "ok" },
  { name: "Номин Их Дэлгүүр", mgr: "Ц. Нямсүрэн",  phone: "+976 9911 4422", last: "5 өдрийн өмнө · 12,300₮",  visits: 8,  status: "ok" },
  { name: "CU Tokyo str.",   mgr: "Б. Долгор",     phone: "+976 8822 1133", last: "Захиалга байхгүй",          visits: 0,  status: "warn" },
  { name: "Их Наран",        mgr: "Г. Тэмүүлэн",   phone: "+976 9988 7766", last: "8 өдрийн өмнө · 5,150₮",   visits: 3,  status: "warn" },
  { name: "Сансар",          mgr: "С. Энхтайван",  phone: "+976 8800 5544", last: "Өчигдөр · 18,200₮",         visits: 22, status: "hot" },
];

const ORDERS = [
  { n: "ORD-2026-00042", store: "Хүнс-Мини",      items: 3,  total: 4690,   status: "pending",   ago: "5 мин",  d: "5/11 · 14:32" },
  { n: "ORD-2026-00041", store: "Номин Их",        items: 8,  total: 12300,  status: "pending",   ago: "20 мин", d: "5/11 · 13:55" },
  { n: "ORD-2026-00040", store: "CU Tokyo str.",   items: 14, total: 27400,  status: "packing",   ago: "1 цаг",  d: "5/10 · 16:12" },
  { n: "ORD-2026-00039", store: "Их Наран",        items: 4,  total: 5150,   status: "shipped",   ago: "3 цаг",  d: "5/10 · 09:22" },
  { n: "ORD-2026-00038", store: "Сансар",          items: 11, total: 18200,  status: "delivered", ago: "1 өдөр", d: "5/09 · 11:08" },
  { n: "ORD-2026-00037", store: "Хүнс-Мини",       items: 6,  total: 7400,   status: "delivered", ago: "1 өдөр", d: "5/09 · 09:40" },
  { n: "ORD-2026-00036", store: "Номин Их",        items: 5,  total: 9200,   status: "delivered", ago: "2 өдөр", d: "5/08 · 15:30" },
];

Object.assign(window, {
  Icon, I, fmt, ProductImage, QtyStepper, AddBtn,
  StoreHeader, TabBar, RepTabBar, AdminSidebar, AdminTopbar, StatusPill,
  PRODUCTS, STORES, ORDERS,
});
