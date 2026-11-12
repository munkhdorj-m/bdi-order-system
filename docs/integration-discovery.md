# Integration discovery — Mercury (gps.mn) and Dayansoft ERP

**Date:** 2026-11-04 · **Status:** discovery done, core decisions made (see *Decisions*); a few questions still open.

Goal: replace day-to-day use of two old tools with our own website's UI, integrated seamlessly.
This document records what each system does and every integration surface found.
It deliberately contains no customer names, phone numbers, emails or credentials.

---

## TL;DR

| | Mercury (app.gps.mn) | Dayansoft ERP |
|---|---|---|
| **What BDI uses it for** | Field sales: orders from stores, delivery assignment, van-sales loading, e-Barimt on sales, per-chain price lists | Accounting system of record: inventory, purchasing, sales invoices, cash/bank, fixed assets, payroll, e-Barimt 3.0 |
| **Vendor** | BTGT LLC (БИ ТИ ЖИ ТИ ХХК), gps.mn | Dayansoft LLC |
| **Form** | PHP web app + Android-only phone app | .NET 10 WPF desktop app (DevExpress 26.1), auto-updating |
| **Where data lives** | Vendor's server | Vendor-hosted SQL Server, database `ERP_5908612` |
| **Official integration** | Documented read API (`getdata`); "RestApi Service" advertised; Excel imports | Excel import/export templates; no third-party API visible in the client |
| **Overlap with our site** | Products, per-chain prices, customers, orders | Products, prices, customers, stock, sales, receivables |

Both systems hold products, prices and customers. **Which one is the source of truth** is the first decision (see *Open questions*).

---

## Decisions (2026-11-04)

| Topic | Decision |
|---|---|
| Scope | **Replace Mercury** with the BDI website; **keep Dayansoft ERP** for accounting |
| Source of truth today | **Mercury** (products, per-chain prices, customers) → migrate from Mercury |
| e-Barimt | **The website issues receipts directly** (takes over Mercury's role) |
| Vendor access | BTGT and Dayansoft don't respond to API requests → **no vendor API keys**; pull BDI's own data from app.gps.mn with BDI's login (read-only, polite rate, never the month-close link). ERP only through its own supported routes |
| Rep screens must cover | **Pre-orders at stores** and **payment collection** (not van sales/loading, not shelf photos) |
| GPS | **Not needed** |

### How Mercury reaches the ERP today

The accountant says Mercury sends data to the ERP automatically. REA shows the reverse direction in code: the ERP
contains `Dayansoft.Erp.Inventory.MercuryService` and three `SyncFromMercury` methods, i.e. **the ERP pulls from
Mercury** (most likely via the `getdata` API, with BDI's key stored in the ERP's settings).

The class's members can't be read statically: `Dayan.dll` carries deliberately malformed metadata (duplicate Module and
Assembly rows, invalid GUID heap — an anti-decompiler measure). We don't defeat that; instead the ERP's own Mercury-sync
settings screen will show the URL/company/key fields. **If the URL is editable**, the website can serve a
Mercury-compatible `getdata` feed (`{"success":1,"date":…,"hdr":[…],"dtl":[…]}`) and the ERP keeps syncing unchanged.
Otherwise, fall back to Dayansoft's `SalesBatch.xlsx` import.

---

## Mercury mirror (built 2026-11-04)

Everything BDI has in Mercury is copied into Supabase so the website can be tested against real data
before Mercury is switched off. **Nothing in the live catalog changes**; mapping into
products / price lists / supermarkets is a separate, later step.

| Piece | What it is |
|---|---|
| `docs/fixes/35-mercury-mirror.sql` | `mercury_records` (each Mercury row verbatim as JSONB, keyed by entity + Mercury id), `mercury_sync_runs`, view `mercury_entity_counts` (too slow on the full copy — one pass over ~185k rows exceeds Supabase's 8 s statement limit — so nothing uses it any more). Admin-read RLS; only the service role writes |
| `web/scripts/mercury-sync.mjs` | The copier. Logs in with BDI's account (`MERCURY_USERNAME` / `MERCURY_PASSWORD` in `web/.env.local`), pulls 24 record types (master lists + history month by month since 2023), upserts by Mercury id, keeps raw pages in `web/scripts/.mercury-data/` (gitignored) |
| `/admin/mercury` | Admin pages to browse the copy: counts per type (small index-backed queries per type, `web/src/lib/mercury-stats.ts`, ~4 s for the whole page), full lists with search, history by month |

Run it again any time to refresh: `cd web` then `npm run mercury:sync`
(or `node --env-file=.env.local scripts/mercury-sync.mjs --only product,customer` / `--from 2026-10-01`).

### First full copy — 2026-11-04 (180,187 rows)

| Record type | Rows | Notes |
|---|---|---|
| `bigdata_line` | 143,500 | every document line, 2023-01-02 → 2026-11-04 |
| `document` | 20,069 | 15,675 carry an e-Barimt number (`НӨАТ-УС`) |
| `order` | 14,927 | incl. ORDER.ID.MN orders; ordered vs delivered amounts, status, deliverer |
| `customer` | 1,285 | with registry no., receivable (авлага), lat/lng |
| `payment_summary` | 141 | Mercury's per-month payment summary |
| `product` | 137 | 33 price columns each, also keyed by price-list id |
| `product_category` / `price_type` / `manufacturer` | 44 / 31 / 20 | |
| `customer_type` / `customer_loan` / `warehouse` / `device` / `user` / `promotion` / `gps_area` | 12 / 11 / 3 / 3 / 2 / 1 / 1 | |

**Verified:** November 2026 sales documents total **19,727,979₮ — exactly Mercury's dashboard**; orders
19,888,310₮ vs dashboard 19,888,309₮ (decimal rounding); every month, documents and BigData lines agree
(0 lines without a document); no month stops at a suspicious round count.

**Empty in Mercury (verified on the page):** keywords, visit plans, bundles, GPS points/routes, and the
"Е-баримт" list (receipt numbers live on documents instead). **Not reachable:** `shop/index/PlanningList`
(sales plans) redirects BDI's account to the product list.

**Second pass (2026-11-05)** added: stock balances, product detail pages (VAT / city-tax flags, e-Barimt
БҮНА + tax codes, unit, hide-from-phone, every list price + show flag), customer cards (contract price list,
discount, rank, zone), settlement ledgers of the customers who owe money, line items of the 37 orders that
never became a document, bank-statement lines, comments, deleted orders and card reads (by date).
Deliberately skipped: the activity log (paginated audit trail) and requisition sheets (derived from orders).

**Mercury's stock is not maintained** — it shows ≤ 0 for every product the website sells. Stock lives in
Dayansoft; never sync it from Mercury (on the website, stock ≤ 0 blocks ordering).

## Loading the mirror into the website — `web/scripts/mercury-import.mjs`

Dry run by default (`npm run mercury:import`); writes only with `--apply`, after backing up every table
it touches to `web/scripts/.mercury-data/import-backup-<time>.json`. Needs `docs/fixes/36-mercury-link.sql`
(additive columns: `products.mercury_id`, `internal_code`, VAT/city-tax flags, e-Barimt codes;
`price_lists.mercury_id`; `supermarkets.registry_number`, `discount_pct`, `receivable`, `lat`, `lng`).

| Data | Rule |
|---|---|
| Products | Linked by `mercury_id`, else barcode **and** name (Mercury reuses barcodes across different products; greedy best-name match, one Mercury product per website product). Updates base price, box count, VAT/e-Barimt fields; never name, photo, category, description, `active`. New Mercury products are added **hidden**. Website barcode typos need a confirmed `--link <sku>=<mercury id>` |
| Stock | Untouched unless `--sync-stock` (don't — see above) |
| Price lists | Linked by `mercury_id`, else name, else a website list whose prices agree (`цэнгэлдэх` = `Цэнгэлдэх супермаркет`, 37/37 equal). Missing ones created. Website-only lists (`Бөмбөгөр 11`, `Очирваань хүнсний дэлгүүр`) untouched |
| List prices | = Mercury. A 0 in Mercury means no special price → the website row is removed |
| Stores | Linked by `external_id`. Price list, registry no., GPS, receivable, discount from Mercury; text fields only fill blanks. Stores on a website-only list keep it |
| Per-store overrides | `--purge-store-overrides` removes the 11,101 rows the old keyword import created on 2026-05-12 (they outrank every list); hand-edited ones stay |
| Store price list | **From real invoices, not Mercury's "Гэрээний үнэ" field.** That field is mostly left at "Үндсэн үнэ" while reps bill a list (every Nomin branch is "base" yet billed Номин prices; 22% of invoice lines since Aug follow a different list). Per store, the list that explains its last 6 months of invoice lines (≥3 lines, ≥60% exact) wins; otherwise an existing store keeps its list and a new one gets the contract list |

### Applied 2026-11-05

- **Products:** all 137 Mercury products are on the website and linked by `mercury_id` (138 products in total;
  77 active). 88 were added (24 visible because Mercury's phone app shows them; the rest hidden); base prices
  and e-Barimt / VAT fields set. Six website products with wrong
  barcodes were linked by hand (OralGos toothbrush 503…→506…, Ecoclean 6 / 100, PAINCER, PAINBack, Yusen
  napkin) and the hidden duplicates the first pass had created were removed (backup in `.mercury-data/`).
  Still unlinked: "Нарийн үстэй шүдний сойз 1ш" (no Mercury counterpart found).
- **Price lists:** 31 linked by `mercury_id` ("Захууд" created; "цэнгэлдэх" = "Цэнгэлдэх супермаркет").
  767 list prices set from Mercury.
- **Stores:** 1,290 (48 new); 778 have a price list (was 598); 173 moved to the list their invoices use;
  "Бөмбөгөр 11" (58) and "Очирваань" (1) kept as set on the website. Registry number, GPS, receivable stored.
- **Overrides:** 11,101 removed (backed up).
- **Verified through the website's own `supermarket_prices` view:** the catalog price equals Mercury's latest
  invoiced price for **96.1%** of store+product pairs invoiced in the last month (was ~35% before). Remaining
  gaps: prices changed since the invoice, the website-only "Бөмбөгөр 11" list, and *Эгшиглэнт сүмбэр*,
  whose invoices fit no single list (left on base — check by hand).
- **Incident, fixed:** the first apply's bulk store upsert mixed rows with different columns, and PostgREST
  wrote NULL for columns a row lacked — 1,144 stores lost district/phone/type/address and 365 their price
  list for about 40 minutes. Restored from the pre-import backup and verified field by field. The importer
  now writes one batch per column set and refuses to finish if any value was blanked unexpectedly.

### Keeping it fresh while testing

Mercury stays the live system until switch-over, so re-run both steps (from `web/`) whenever you want the
website to catch up — the importer is idempotent and backs up before writing:

```
node --env-file=.env.local scripts/mercury-sync.mjs
node --env-file=.env.local scripts/mercury-import.mjs
node --env-file=.env.local scripts/mercury-import.mjs --apply --activate-new
```

(The middle command is the dry run — read it before applying.)

**Safety:** strictly read-only toward Mercury. Every request must be on an allowlist of read pages and
pass a write-action blocklist; redirects are never followed. Mercury exposes destructive actions as plain
GET links (`cron/jobs/product_balance_cron/66` closes the month, `cron/jobs/order_close/66` closes waybills,
`shop/index/CloseOrders`), so this matters.

**Login:** Mercury's login page posts `u` / `p` to `ajax/index/login` (jQuery). Sessions are cookie-based; an
expired session returns the login page with HTTP 200, which the script detects and re-logs in once.

### API keys

- **Mercury `getdata` key:** BDI already has one — the ERP's `MercuryService` / `SyncFromMercury` pulls
  Mercury with company **66** and its secret `skey`, stored in Dayansoft's Mercury connection settings.
  If it isn't there, request it from BTGT. Not needed for the mirror (it uses the login).
- **Dayansoft:** no self-service key. Request an API or a read-only SQL user for `ERP_5908612` in writing;
  fallback is Dayansoft's own Excel import templates.

### Daily screens built (2026-11-05, fix 37)

Mercury's day-to-day screens, now in the website (tested end to end with one test order, then removed):

| Mercury | Website |
|---|---|
| Захиалга нэмэх | `/admin/orders/new` — store's own price list, payment Зээл / Данс / Бэлэн, delivery day |
| Захиалгын хүргэлт хуваарлах | `/admin/dispatch` — runs (Ачилт) per day + distributor, assign / close / reopen |
| Хаасан захиалгын жагсаалт | `/admin/shipments` |
| Падаан (Зарлагын баримт) | `/print/invoices` — A4 with 2 copies, or A5 |
| Нэгтгэл жагсаалт | `/print/picklist` |
| MS-Excel | `/admin/export` — by run, delivery day or order dates (orders / lines / product totals) |
| НӨАТУС V3 | `/admin/ebarimt` + `web/scripts/ebarimt-agent.mjs` next to PosAPI 3.0 — see `docs/ebarimt-setup.md` |

e-Barimt sending waits on BDI's own PosAPI 3.0 registration (today BTGT's PosAPI sends BDI's receipts).
The public РД → ТТД lookup (`api.ebarimt.mn/api/info/check/getTinInfo`) was checked and works.

### What was still missing to switch Mercury off (2026-11-12, fix 43)

A look at how BDI really uses Mercury (the copy, Aug–Nov 2026): ~400 orders a month from 153 customers;
one delivery person (who also takes about half the orders on the phone app), the office takes the rest;
80% on credit. **In about 1 order in 7 the delivered amount differs from the ordered one** (144 of 1,274
delivered less, 32 more), returns are rare (6), and Mercury holds **no payments at all** — its "Авлага"
is just accumulated credit sales, receivables live in Dayansoft. So payment collection is not needed to
replace Mercury; correcting an order is.

| Gap | Now |
|---|---|
| An order's lines couldn't be changed after it was placed | Order page → **Засах** (quantity, take off, add a product, reason); a store's own order has its deals worked out again; history under the order; `orders.ordered_total` keeps what was ordered. One database function writes it all or nothing (`replace_order_lines`, fix 43; logic in `web/src/lib/orders/correction.ts` + `correct.ts`) |
| No "delivered" step per run | Closed run on `/admin/dispatch`: **Хүргэсэн** per order (with undo), **Бүгд хүргэгдсэн**, **Буцаах** for an order that came back |
| The delivery person had no screen | `/rep/delivery` for a login linked to a Түгээгч (`distributors.profile_id`, fix 43): his runs, quantities handed over, **Хүргэсэн** / **Хүргэж чадсангүй** |
| Nobody had a rep account; 1,290 stores had no rep | `/admin/users/[id]` for a rep: assign stores in bulk by Mercury's "Менежер", link to a Түгээгч |
| Products imported from Mercury had stock 0 = "Дууссан", not orderable (28 visible) | `/admin/products` → **Үлдэгдэлгүй** → one figure for everything in view |
| Dayansoft gets its sales by pulling Mercury | `/admin/shipments` → **Санхүүд өгөх файл (Dayansoft)**: the sales of a range of delivery days in `SalesBatch.xlsx` layout (`web/src/lib/dayansoft.ts`). Not yet tried against a real import |
| Refreshing from Mercury was two commands and ~20 minutes; every run ended "partial" | `npm run mercury:refresh` (quick copy + what would change; `-- --apply` to apply). The page BDI's account can't open no longer counts as an error; a run that was killed is closed as failed |
| No picture of what is left to do | `/admin/mercury`: "Mercury-г унтраахад бэлэн үү?" checklist from live data |

Step-by-step for the switch and the daily routine: `docs/mercury-switchover.md`. Still outside BDI's
hands: BDI's own PosAPI 3.0 for e-Barimt, and the accountant's test of the Dayansoft file.

### Categories like Mercury (2026-11-05, fix 38)

The website had 7 long categories from the first xlsx; 82 of 138 products (24 visible) had none, and a
pocket tissue sat under "Эко угаалгын ялтас". Now the categories follow Mercury's **Ангилал** list
(Mercury files each product under Бүлэг/Үйлдвэр → Ангилал; stores only need the Ангилал):

- 20 categories; the 15 that have visible products show in the store catalog, ordered by the last
  6 months of sales: Нойтон салфетка, Цаасан бүтээгдэхүүн, Ариун цэврийн цаас, Пролон спонж, Хөвөн,
  Ам арчилгаа, Наалтууд, Цэвэрлэгээ, Эко угаалгын ялтас, Гоо сайхан, Гоймон, Ариун цэврийн өрөөний
  иж бүрдэл, Ванны хөшиг, Гал тогооны хос дэвсгэр, Бүс тэлээ. The other 5 (kitchen appliances, cleaning
  robots, massagers, phone holders, shoe covers) hold hidden products only.
- Mercury's near-duplicates were merged (three motorcycle phone-holder sizes → Утасны суурь, two
  "Цэвэрлэгээ", two "Бүс Тэлээ"). The protein pasta stays in Гоймон (Mercury files it under its
  supplier's "ГАЛ ТОГОО").
- The 7 old rows were renamed in place, so their ids (deal links, the old cash discount) still work.
  Backup of the old state: `web/scripts/.mercury-data/recategorize-backup-2026-11-05T06-57-32-842Z.json`.
- `categories.mercury_ids` lists the Mercury category ids of each category; `mercury-import.mjs` uses it
  to file a product that has no category (new Mercury products). It never moves a categorised product.
- `categories.icon` is the picture/colour the app shows; admins pick it on **/admin/categories**
  (rename, reorder, add, delete empty ones), and move products from **/admin/products**.
- Mercury's product photos were checked and **not** used: its photo links point at wrong products
  (the bathroom set's photo is kitchen wipes, another is a screenshot of a number). Products without a
  photo show their category's picture; /admin/products has a "Зураггүй" filter (25 visible products).

Ordering screens built on this: the store catalog (`/catalog`), the rep catalog and the admin
"as the store sees it" view (`/admin/supermarkets/[id]/catalog`) share one component
(`web/src/components/catalog/store-catalog.tsx`): category sections with a sticky picture rail,
"Өмнө авсан" (what this store ordered before) first, one-tap "+box" buttons. Admin order entry
(`/admin/orders/new`) groups rows the same way with photos.

---

## Mercury — app.gps.mn

### Modules seen (BDI account)

Top menu: Эхлэх цонх · Машинууд · Цэгүүд · Зам · Талбай · Тайлан · Харилцагчид · Хэрэглэгч · Бусад · Засварын дуудлага.
Launcher modules: Google map, OpenStreet map, Харилцагчийн модуль (customers), Борлуулалтын систем (sales).

Sales module (`/index.php/shop/index/...`): Хяналтын цонх (dashboard), Бараа (`ProductList`), Баримтын жагсаалт (`OrdersList`),
Төлбөр/Заалт (`PaymentList`), Е-баримт (`Ebarimt`), Нярав (`Nyrav`), Тайлан (`report`), Тохиргоо (`Settings`).

### Data observed

- **Dashboard:** monthly orders / sales / returns totals; top-10 products; top-10 sellers. "Refreshed every 3 days".
- **Products (`ProductList`) — 137 items.** Fields: group/manufacturer, category, barcode, internal code, INF ID, name,
  units per box, show/hide, sort order, **base price + ~33 per-chain/group price columns** (e.g. Номин, E-Mart, GS25, CU,
  Монос, pharmacy chains, markets, "Хямдрал"). Actions: XLS import, "pocket XML" import, promotions, trade bundles,
  stock-count reconcile, duplicate check by internal code, price table.
- **Customers (`home/index/shop2`) — 1,285 records.** Fields: manager (owning staff), customer type (Супермаркет,
  Мини маркет, Сүлжээ, Хүнсний 6/8 нэр, Бөөний төв, Зах, Байгууллага, Хувь хүн, ТҮЦ, …), internal code, company name,
  registry number (РД), point (branch) name, phone, bank account, district/aimag, address, **receivable (авлага)**.
  Extras: shelf-photo survey, assortment survey, feedback, credit registration, delivery assignment, Excel import/export.
- **Orders (`home/index/OrderListShop2`).** Fields: taken by (staff device), customer code/name/type,
  payment form (Дансаар / Зээлээр / cash), ordered at, status (Хувиарлагдсан / Хувиарлагдаагүй / Цуцлагдсан),
  deliverer (түгээгч), quantity, order amount, delivered amount. Extras: requisition sheet, undelivered list, statistics.
- **Documents (`shop/index/OrdersList`).** Warehouse receipts/issues, **loading (ачилт)** to a salesperson,
  sales to customers with payment type and **e-Barimt receipt ID (НӨАТ-УС)**, returns, "approve/merge loading orders",
  "send to VAT system".
- **Devices (`home/index/CarList`) — 3 staff phones**, no vehicle trackers. Live map endpoint returns every device at
  `0,0` / 1970 timestamp → **GPS tracking is not active**.

### Integration surface

1. **Official read API** (manual p.22, "for developers"):
   ```
   GET/POST https://app.gps.mn/index.php/home/index/getdata/{token},{time},{company},{date}
   POST body: skey=<company data-pull secret, issued by BTGT>
   token = md5(company + "|autoLogin:" + time + "|u:" + date)   // time = unix seconds, date = Y-m-d
   → {"success":1,"date":"…","hdr":[…],"dtl":[…]}             // document headers + lines for that date
   errors: {"success":0,"error":"wrong time"|"wrong token"|"asp data faild"}
   ```
   BDI's company ID is probably **66** (seen in an account link) — confirm with BTGT. The manual warns the base URL may change.
2. **"RestApi Service for exchanging data with other systems"** — listed as feature #32; no docs found. Ask BTGT
   whether it can **create orders/customers** (write), not just read.
3. **ORDER.ID.MN** — Mercury's own online ordering portal for stores (enable under Хэрэглэгч → Тохиргоо;
   per-product "Захиалгын үнэ"). Orders from it land in Mercury's order list.
4. **Excel imports** — products (XLS / pocket XML), customers, warehouse in/out.
5. **Internal AJAX endpoints** (session-cookie only, *not* an API — fragile, don't build on them):
   `POST /index.php/ajax/index/lastpos` (positions: `lat,lng,speed,angel,time,name,…` keyed by device id),
   `GET /ajax/index/shop2order/`, `GET /ajax/index/soslist`.

> ⚠️ The dashboard link **"Энэ сарын гүйлгээ өндөрлөх"** is a plain GET to `/index.php/cron/jobs/product_balance_cron/…`
> that **closes the month**. Never crawl, prefetch or automate Mercury pages blindly.

Tech: PHP with ThinkPHP-style routes (`index.php/{module}/{controller}/{action}`), jQuery, jQuery UI, DataTables,
Google Maps / OSM. Phone app: Android only (Play Store "MERCURY", BTGT company); no iPhone support.

---

## Dayansoft ERP

### What it is

- `Dayan.exe` / `Dayan.dll` **v11.10.1**, .NET 10 (`net10.0`, WPF), DevExpress v26.1 UI, `DayanUpdater.exe` auto-update.
- REA managed analysis (8,642 types, 78,259 methods). Main namespaces: `Erp.MasterData`, `Erp.Inventory`,
  `Erp.GeneralLedger`, `Erp.Invoice`, `Erp.Pos`, `Erp.FixedAsset`, `Erp.Payroll`, `Erp.Manufacture`, `Erp.Barcode`,
  `Erp.Budget`, `Erp.Cash`, `Erp.Cargo`, `Erp.Membership`, `Erp.Dashboard`.
- **Obfuscated** with a commercial protector (randomised resource/type names). The vendor does not intend the code
  to be reverse engineered — integrate through supported routes, not by extracting internals.

### How it connects

1. Login → Dayansoft auth API (`Erp.Api.Client.Auth`: `DeviceLogin/Refresh/Logout`, returns `DbDto`).
2. The app then connects **directly to a Dayansoft-hosted SQL Server** (`Microsoft.Data.SqlClient`, Dapper, XPO),
   database **`ERP_5908612`** (host name is masked in the app's own logs).
3. Web services at `s1.dayansoft.mn` (`WebServiceHelper` / `WebServiceUtils`: service check, app log, licensing).
4. Real-time server push (`Dayansoft.Sse`).

### Built-in integrations (the vendor does integrations)

Banks (Khan, Golomt, TDB, XacBank, State/MBank, Arig) · **e-Barimt 3.0** (receipts, returns, TIN lookup, EasyRegister QR)
· HoReCaSoft · Taxacc · "Timely" attendance → payroll. **No e-commerce / online-shop API** in the client.

### Documents & templates (what the business does in it)

Print layouts (`Invoices/*.repx`): sales order / delivery / quotation / invoice / return, purchase order / invoice / return,
warehouse receipt / issue, goods transfer / count, cash receipt / payment, bank payment order, e-Barimt, ledger,
receivable–payable confirmation, fixed-asset docs, many barcode price-label sizes. Reports: ND-8 payroll.

Excel import templates (`Templates/`), most useful for us:

- **`Dayansoft.Template.SalesBatch.xlsx`** — Дугаар, Огноо, Харилцагч код, Харилцагч нэр, Утга, Борлуулагч, Пос код, Багц №,
  Бараа данс, Данс нэр, Бараа код, Бараа нэр, Бараа тайлбар, Comment, Тоо хэмжээ, Нэгж үнэ, Нийт үнэ, Хөнгөлөлт,
  Нэгж дүн, Нийт дүн, НӨАТ, НХАТ, Сериал дугаар, Дуусах огноо
- **`Dayansoft.Template.ItemPrice.xlsx`** — Бараа код, Бараа нэр, Үнийн жагсаалт, Зарах үнэ, Бөөний тоо, Бөөний үнэ, Хөнгөлөлт %
- Also: `Item.xls`, `Partner.xls`, `Sales.xls`, `PurchaseBatch.xlsx`, `GoodsTransferBatch.xlsx`, `Journal.xlsx`, …

Exports seen: inventory balance, sales by product, sales ledger, settlement (receivables) detail/summary, purchase detail.

---

## Integration options (to choose from)

| Option | Mercury | Dayansoft | Effort / risk |
|---|---|---|---|
| **A. Official APIs** | `getdata` read API now; ask BTGT about write API | Ask Dayansoft for an API or a read-only DB user | Best long-term; depends on vendors |
| **B. Excel bridge** | Import products/customers via XLS | Website generates `SalesBatch.xlsx` / reads exports | Works today, no vendor needed; one manual click per batch |
| **C. Replace** | Website takes over order-taking, delivery assignment, rep app | Keep ERP for accounting only | Biggest win for UX; must keep e-Barimt + accounting correct |
| ~~D. Scrape internal endpoints~~ | Session-cookie AJAX, stored passwords | Extracting DB credentials | **Not recommended** — fragile, likely breaches vendor terms |

---

## Open questions

Answered 2026-11-04: scope, source of truth, e-Barimt owner, vendor access, rep features, GPS (see *Decisions*).

Still open:

1. Screenshot of the ERP's **Mercury sync settings** — is the Mercury URL editable?
2. **e-Barimt registration:** BDI's e-Barimt 3.0 merchant setup, and where PosAPI will run (it needs an always-on
   machine — Vercel can't host it). Verify current tax-authority requirements before building.
3. **Mercury Android APK** (from the rep's phone, not from APK mirror sites) — optional, shows how the app syncs.
4. **Migration scope:** products, 33 price lists, 1,285 customers, receivables (авлага), order history (how far back)?
5. **Cutover:** run Mercury and the website in parallel for a while, or switch on a fixed date?
6. **Delivery:** who delivers, and is per-order driver assignment needed?
7. **Phone orders:** office staff take orders by phone in Mercury today — give them the rep screens?
8. Does any store order through ORDER.ID.MN today?

---

## Tooling installed for this work

- **REA 6.8.0** (`npm i -g rea-agents`), registered for Claude Code in `~/.claude.json` (`mcpServers.rea`).
- **Ghidra 12.1.4** at `C:\Users\Munkhdorj\tools\ghidra_12.1.4_PUBLIC`, **Temurin JDK 21.0.13** at
  `C:\Users\Munkhdorj\tools\jdk-21.0.13+9`; both passed to REA through the registration's `env`
  (`GHIDRA_INSTALL_DIR`, `JAVA_HOME`). Verified with `rea doctor --provider ghidra` and a real Ghidra analysis.
- The ERP is .NET, so REA's managed-code analysis applies to it; Ghidra is for native (C/C++) binaries.
