# BDI B2B App — Screen Wireframes (v1)

Text-art layouts for every screen in v1. These are **not pixel-perfect** — they show structure, hierarchy, and what data goes where. Real UI will be built with Tailwind + shadcn/ui components.

Three roles, three flows:

- [Buyer flow](#buyer-flow-supermarket-buying-manager) — mobile-first
- [Admin flow](#admin-flow-bdi-staff) — desktop-first
- [Rep flow](#rep-flow) — mobile-first, hybrid

---

## Buyer flow (supermarket buying manager)

> **Device:** phone. Buyer opens the PWA in their browser, "Add to Home Screen" once, opens it like an app after that.

### B1. Login (phone + OTP)

```
┌──────────────────────────────┐
│           BDI                │
│      Захиалгын систем        │
│                              │
│   Утасны дугаар              │
│   ┌────────────────────────┐ │
│   │ +976 ________          │ │
│   └────────────────────────┘ │
│                              │
│   ┌────────────────────────┐ │
│   │      Код илгээх        │ │ ← primary button
│   └────────────────────────┘ │
└──────────────────────────────┘
```

After "Код илгээх" → SMS arrives → OTP entry screen → on success, route by role.

---

### B2. Catalog (home)

Default landing for `role = buyer`.

```
┌──────────────────────────────┐
│ ☰  BDI            🛒 3       │ ← top bar: menu + cart badge
├──────────────────────────────┤
│ 🔍  Хайх (барааны нэр)       │ ← search input
├──────────────────────────────┤
│ [Бүгд] [Цаас] [Хөвөн] [...]  │ ← category chips, horizontal scroll
├──────────────────────────────┤
│                              │
│  ┌──────┐  ┌──────┐          │
│  │ img  │  │ img  │          │ ← 2-column grid of products
│  │      │  │      │          │
│  │ Soft │  │ Soft │          │
│  │ Leaf │  │ Leaf │          │
│  │ ...  │  │ ...  │          │
│  │1,220₮│  │2,250₮│          │ ← effective_price for this store
│  │  [+] │  │  [+] │          │ ← quick add to cart
│  └──────┘  └──────┘          │
│                              │
│  ┌──────┐  ┌──────┐          │
│  │ ...  │  │ ...  │          │
└──────────────────────────────┘
```

**Data source:** `supermarket_prices` view filtered by current user's `supermarket_id`.
**Search:** client-side filter on `name` and `brand` (catalog is small, ~50 SKUs).

---

### B3. Product detail

```
┌──────────────────────────────┐
│ ←  Бүтээгдэхүүн              │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │                        │  │
│  │     PRODUCT IMAGE      │  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  Soft Leaf 99.9% ариутгалын  │
│  нойтон салфетка 10ш         │
│                              │
│  Бренд: Soft Leaf            │
│  SKU:  4890326012629         │
│                              │
│  1,220₮ / уут                │
│  Хайрцагт 120 ш              │
│                              │
│  Тайлбар:                    │
│  Нян бактерийн 99.9% …       │
│                              │
│         ─  1  +              │ ← qty stepper
│                              │
│  ┌────────────────────────┐  │
│  │   🛒 Сагсанд нэмэх     │  │ ← primary
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

### B4. Cart

```
┌──────────────────────────────┐
│ ←  Миний сагс                │
├──────────────────────────────┤
│                              │
│  ┌─┬────────────────┬────┐   │
│  │📷│ Soft Leaf …   │ ─2+│   │ ← qty inline edit, swipe-to-remove
│  │  │ 1,220₮ x 2    │    │   │
│  │  │ = 2,440₮      │    │   │
│  └─┴────────────────┴────┘   │
│  ┌─┬────────────────┬────┐   │
│  │📷│ Soft Leaf …   │ ─1+│   │
│  │  │ 2,250₮ x 1    │    │   │
│  │  │ = 2,250₮      │    │   │
│  └─┴────────────────┴────┘   │
│                              │
│  Тэмдэглэл (заавал биш)      │
│  ┌────────────────────────┐  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  Нийт: 4,690₮                │
│                              │
│  ┌────────────────────────┐  │
│  │   Захиалга илгээх      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**Cart storage:** client-side (localStorage) until submitted. No DB row until "Захиалга илгээх".

---

### B5. Order placed confirmation

```
┌──────────────────────────────┐
│                              │
│             ✅               │
│                              │
│     Захиалга илгээгдлээ      │
│                              │
│      ORD-2026-00042          │
│                              │
│   BDI таны захиалгыг хүлээж  │
│   авлаа. Удахгүй холбогдоно. │
│                              │
│  ┌────────────────────────┐  │
│  │  Захиалгаа харах       │  │ → goes to B6
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  Каталог руу буцах     │  │ → B2
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

### B6. My orders (list)

```
┌──────────────────────────────┐
│ ☰  Миний захиалгууд          │
├──────────────────────────────┤
│ ORD-2026-00042   🟡 Хүлээгдэж│
│ 2026-05-11   4,690₮          │
├──────────────────────────────┤
│ ORD-2026-00038   🟢 Хүргэгдсэн│
│ 2026-05-08   12,300₮         │
├──────────────────────────────┤
│ ORD-2026-00033   🔵 Илгээсэн │
│ 2026-05-05   8,150₮          │
└──────────────────────────────┘
```

Status colors:
- 🟡 pending / confirmed / packing
- 🔵 shipped
- 🟢 delivered
- ⚫ cancelled

Tap → order detail (same layout as cart, read-only, with status timeline at top).

---

## Admin flow (BDI staff)

> **Device:** desktop browser (laptop). Some admin tasks happen at a counter or warehouse so the layout must also work on tablet.

### A1. Login
Same as B1 but routes to A2 dashboard on success.

### A2. Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ BDI Admin                                       Munkhdorj ⌄  🔓     │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│ 🏠 Дашбоард  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ 📦 Захиалга  │   │ Шинэ    │ │ Багцлаж │ │ Илгээсэн│ │ 7 хоног │    │
│ 🛒 Бараа     │   │ захиалга│ │ байгаа  │ │         │ │ нийт    │    │
│ 🏪 Дэлгүүр   │   │   12    │ │    5    │ │   3     │ │ 1.4M ₮  │    │
│ 💵 Үнэ       │   └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│ 👥 Хэрэглэгч │                                                      │
│              │   Шинэ захиалга                                      │
│              │   ┌────────────────────────────────────────────┐    │
│              │   │ ORD-…42  Хүнс-Мини  4,690₮  5 мин өмнө    │    │
│              │   │ ORD-…41  Номин Их  12,300₮  20 мин өмнө   │    │
│              │   │ ORD-…40  ...                               │    │
│              │   └────────────────────────────────────────────┘    │
│              │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

### A3. Orders list

```
┌─────────────────────────────────────────────────────────────────────┐
│ Захиалгууд                                                          │
│ ┌──────────────┬──────────────┬─────────────┐                       │
│ │ Статус: All ⌄│ Дэлгүүр: All⌄│ 📅 Огноо    │     [+ Шинэ захиалга]│
│ └──────────────┴──────────────┴─────────────┘                       │
├─────────────────────────────────────────────────────────────────────┤
│ Дугаар         │ Дэлгүүр       │ Статус   │ Үнийн дүн │ Огноо       │
├────────────────┼───────────────┼──────────┼───────────┼─────────────┤
│ ORD-2026-00042 │ Хүнс-Мини     │ 🟡 Шинэ  │  4,690₮   │ 2026-05-11  │
│ ORD-2026-00041 │ Номин Их      │ 🟡 Шинэ  │ 12,300₮   │ 2026-05-11  │
│ ORD-2026-00040 │ CU Tokyo str  │ 🟦 Багцл │ 27,400₮   │ 2026-05-10  │
│ ORD-2026-00039 │ Хүнс-Мини     │ 🟢 Хүргэг│  5,150₮   │ 2026-05-09  │
│  …                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### A4. Order detail (admin)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Захиалга  ORD-2026-00042                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Дэлгүүр:    Хүнс-Мини          Статус: ┌──────────────┐ ▼          │
│ Захиалсан:  Б. Энхээ            (admin) │ Хүлээгдэж буй│            │
│ Утас:       +976 8811 2233               └──────────────┘            │
│ Огноо:      2026-05-11 14:32                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Барааны жагсаалт                                                    │
│ ┌─────────────────────────────────────┬─────┬────────┬───────────┐ │
│ │ Бараа                                │ Тоо │ Үнэ    │ Дүн       │ │
│ ├─────────────────────────────────────┼─────┼────────┼───────────┤ │
│ │ Soft Leaf 99.9% салфетка 10ш        │  2  │ 1,220₮ │  2,440₮   │ │
│ │ Soft Leaf салфетка 25ш тагтай       │  1  │ 2,250₮ │  2,250₮   │ │
│ └─────────────────────────────────────┴─────┴────────┴───────────┘ │
│                                                Нийт:    4,690₮      │
│                                                                     │
│ Тэмдэглэл: Маргааш 10цаг хүртэл хүргэх боломжтой бол хүргэнэ үү     │
├─────────────────────────────────────────────────────────────────────┤
│ Төлвийн түүх                                                        │
│ • Хүлээгдэж буй          2026-05-11 14:32                           │
│                                                                     │
│              [ Баталгаажуулах ] [ Цуцлах ]                          │
└─────────────────────────────────────────────────────────────────────┘
```

Status dropdown options match `order_status` enum. Changing it timestamps the corresponding column (`confirmed_at`, `delivered_at`).

### A5. Products list & edit

```
┌─────────────────────────────────────────────────────────────────────┐
│ Бараа                                              [+ Шинэ бараа]   │
├─────────────────────────────────────────────────────────────────────┤
│ Filter: Ангилал ⌄    🔍 Хайх                                        │
├─────┬──────────────────────────────┬────────┬────────┬──────────────┤
│ 📷  │ Нэр                          │ SKU    │ Үнэ    │ Үлдэгдэл     │
├─────┼──────────────────────────────┼────────┼────────┼──────────────┤
│ img │ Soft Leaf салфетка 10ш      │ 4890…  │ 1,220₮ │   48         │
│ img │ Soft Leaf салфетка 25ш      │ 4891…  │ 2,250₮ │   22         │
│ ... │ ...                          │ ...    │ ...    │   ...        │
└─────┴──────────────────────────────┴────────┴────────┴──────────────┘
```

Click row → edit modal with fields matching `products` columns + image upload.

### A6. Supermarket list & detail

Standard CRUD list; detail screen includes a "Хариуцагч төлөөлөгч" dropdown to assign a rep.

### A7. Price list editor (per supermarket)

The most important admin screen. Lets BDI set per-customer prices.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Дэлгүүр: Хүнс-Мини                                                │
├─────────────────────────────────────────────────────────────────────┤
│ Үнийн жагсаалт                                                      │
│ ┌──────────────────────────────────┬──────────┬───────────────────┐│
│ │ Бараа                             │ Жишиг үнэ│ Энэ дэлгүүрийн үнэ││
│ ├──────────────────────────────────┼──────────┼───────────────────┤│
│ │ Soft Leaf салфетка 10ш           │  1,220₮  │ ┌──────┐          ││
│ │                                   │          │ │1,180₮│ (overrid)││
│ │                                   │          │ └──────┘          ││
│ │ Soft Leaf салфетка 25ш           │  2,250₮  │ ┌──────┐          ││
│ │                                   │          │ │     │ (default) ││
│ │                                   │          │ └──────┘          ││
│ │ ...                                                              ││
│ └──────────────────────────────────┴──────────┴───────────────────┘│
│                                                                     │
│            [ Хадгалах ]   [ Excel-ээс импортлох ]                  │
└─────────────────────────────────────────────────────────────────────┘
```

Empty input = use default base_price (no row in `customer_prices`). Filled = override.

### A8. Users
List of all profiles. Admin can create rep accounts and invite buyers (sends SMS invite with a one-time signup link tied to a supermarket).

---

## Rep flow

> **Device:** phone (reps are mobile). Same login as B1, lands on R1.

### R1. My stores

```
┌──────────────────────────────┐
│ ☰  Миний дэлгүүрүүд          │
├──────────────────────────────┤
│ 🏪 Хүнс-Мини                 │
│    Сүүлийн захиалга: 2 өдрийн│
├──────────────────────────────┤
│ 🏪 Номин Их Дэлгүүр          │
│    Сүүлийн захиалга: 5 өдрийн│
├──────────────────────────────┤
│ 🏪 CU Tokyo str.             │
│    Захиалга байхгүй          │
└──────────────────────────────┘
```

### R2. Store detail / "Order on behalf" entry

```
┌──────────────────────────────┐
│ ←  Хүнс-Мини                 │
├──────────────────────────────┤
│ Хариуцагч: Б. Энхээ          │
│ Утас:      +976 8811 2233    │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ + Захиалга үүсгэх      │  │ → opens R3 (same UX as B2)
│  └────────────────────────┘  │
│                              │
│  Сүүлийн захиалгууд          │
│  • ORD-…42  4,690₮  🟡       │
│  • ORD-…35  9,400₮  🟢       │
└──────────────────────────────┘
```

### R3. Order on behalf (catalog → cart → submit)

Identical to B2/B3/B4, but **prices come from the selected store's `supermarket_prices` view**, and the resulting order's `placed_by` is the rep's user id while `supermarket_id` is the chosen store.

A small banner at the top of the catalog shows context:

```
┌──────────────────────────────┐
│ 📋 Хүнс-Мини-н нэрийн өмнөөс │ ← context banner
├──────────────────────────────┤
│  …rest is identical to B2…   │
```

---

## Components shared across flows

These get built once and reused:

- **PhoneOtpForm** — used in every login flow
- **ProductCard** — used in catalog (buyer, rep), products list (admin)
- **CartLineItem** — used in cart (buyer, rep)
- **OrderStatusBadge** — used everywhere status appears
- **StatusTimeline** — order detail (buyer, admin)
- **AppShell** — top bar + nav drawer (mobile) / sidebar (admin desktop)

---

## What's NOT in v1

Deferred to keep scope tight:

- Push notifications (use SMS instead for "order placed" / "status changed")
- Offline mode
- Native iOS/Android app
- BTGT integration
- Returns/refunds workflow
- Multi-language toggle (Mongolian only for v1)
- Invoice PDF generation
- Analytics dashboards beyond the simple stats on A2

These are easy to add post-launch if the app actually gets adopted.
