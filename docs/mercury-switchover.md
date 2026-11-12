# Switching from Mercury to the website

How to move BDI's daily sales work off Mercury (app.gps.mn) and onto the
website, in order. The same checklist, ticking itself off from live data,
is on **/admin/mercury** ("Mercury-г унтраахад бэлэн үү?").

Written 2026-11-12. Background and findings: `integration-discovery.md`.

## What Mercury does for BDI today, and where it is on the website

Measured from the copy of Mercury (August–November 2026): about 400 orders
a month, 153 customers, one delivery person who also takes about half of
the orders on Mercury's phone app; the office takes the rest by phone.

| In Mercury | On the website | State |
| --- | --- | --- |
| Office enters a phone order | `/admin/orders/new` | ready |
| Rep takes an order at the store (phone app) | `/rep` (rep's stores → catalog → cart) | ready — needs a rep account with stores (step 4) |
| Stores order themselves (ORDER.ID.MN) | the store app (`/catalog`) | ready, in use |
| Assign orders to a delivery run | `/admin/dispatch` | ready |
| Delivery note (Падаан), loading list (Нэгтгэл) | `/print/invoices`, `/print/picklist` from the run | ready |
| Delivered quantities differ from the order (about 1 order in 7) | order page → **Засах**, or the delivery person's phone | ready — needs fix 43 (step 1) |
| Delivery person marks deliveries on the phone | `/rep/delivery` | ready — needs fix 43 and the link in step 4 |
| List of closed runs, Excel | `/admin/shipments`, `/admin/export` | ready |
| Returns (about 2 a month) | return the e-Barimt, then **Засах** on the order with reason "Буцаалт" | ready |
| e-Barimt on each sale | `/admin/ebarimt` + the agent next to PosAPI | built; **waits for BDI's own PosAPI 3.0** (`ebarimt-setup.md`) |
| Dayansoft pulls the sales from Mercury | `/admin/shipments` → "Санхүүд өгөх файл (Dayansoft)" | built; **needs one test import with the accountant** (step 6) |
| Price lists, customers, products | `/admin/price-lists`, `/admin/supermarkets`, `/admin/products` | ready; kept level with Mercury by step 2 until the switch |

Not carried over, on purpose: GPS, shelf photos, visit plans (unused in
Mercury), Mercury's stock (not kept up there — stock lives in Dayansoft)
and customer balances (Mercury holds no payments; receivables are in
Dayansoft).

## Before the switch — once

1. **Database change.** Run `docs/fixes/43-mercury-replacement.sql` in the
   Supabase SQL editor (after the website code is deployed). It tests
   itself and changes nothing if a check fails. Until it runs, "Засах" on
   an order and the delivery screen say so instead of working.

2. **Bring the website level with Mercury.** On the office computer, in
   the `web` folder:

   ```bash
   npm run mercury:refresh
   ```

   It copies the latest from Mercury (a few minutes, read-only) and prints
   what would change on the website. If the list looks right:

   ```bash
   npm run mercury:refresh -- --apply
   ```

   Repeat every few days for as long as prices and customers are still
   being changed in Mercury. (Best outside office hours — it signs in to
   Mercury with BDI's account.)

3. **Make every visible product orderable.** Products that came from
   Mercury arrive with stock 0, which shows as "Дууссан" to stores.
   `/admin/products` → **Үлдэгдэлгүй** → type a figure → "Харагдаж буй N
   бараанд тавих". From then on stock on the website is only what the
   office types in; set a product to 0 when it really is out.

4. **Accounts for the people who work in Mercury's phone app.**
   - `/admin/users/new` → a "Төлөөлөгч" account for each person who takes
     orders at stores.
   - Open that account: **Хариуцах дэлгүүр** → pick their name under
     "Mercury дээрх менежерээр нь оноох" → **Оноох**. A rep sees and
     orders for assigned stores only.
   - If they also deliver: **Хүргэлт хийдэг үү?** → choose their Түгээгч →
     **Хадгалах**. Their phone then shows "Хүргэлт" on the rep home page.

5. **Tidy up what is open.** `/admin/mercury` lists orders that have been
   "Хүргэлтэнд гарсан" for more than two days; open the run on
   `/admin/dispatch` and press **Бүгд хүргэгдсэн** (or **Буцаах** for the
   ones that never arrived).

6. **Accounting.** With the accountant, on `/admin/shipments`: open
   "Санхүүд өгөх файл (Dayansoft)", choose one delivered day, type the
   item account ("Бараа данс") they give you, **Шалгах**, **Файл татах**,
   and import the file with Dayansoft's own batch import for sales (the
   file has the layout of its template `Dayansoft.Template.SalesBatch.xlsx`).
   If Dayansoft doesn't recognise the customers or items, switch the code
   used (РД ↔ Mercury number, internal code ↔ barcode) and try again.
   What worked is the setting to keep. This step has not been tried
   against a real Dayansoft import yet — expect a round or two.

7. **e-Barimt.** Register BDI's own PosAPI 3.0 and start the agent
   (`ebarimt-setup.md`). Until then the website cannot send receipts — see
   "Running both" below.

## A day on the website

| When | Who | Where | What |
| --- | --- | --- | --- |
| All day | stores, reps, office | store app · `/rep` · `/admin/orders/new` | orders come in ("Хүлээгдэж буй"; office-entered ones are already "Баталгаажсан") |
| Before loading | office | `/admin/dispatch` | pick the day → **Шинэ ачилт** → tick orders → add to the run → print **Падаан** and **Нэгтгэл** → **Ачилт хаах** (orders become "Хүргэлтэнд гарсан", stores are told) |
| At each store | delivery person | `/rep/delivery` on the phone | open the store → set the quantities actually handed over → **Хүргэсэн**. Shop closed: **Хүргэж чадсангүй** (the order goes back to the office with the reason) |
| After the run | office | `/admin/dispatch` (the closed run) | anything the delivery person didn't tick: **Хүргэсэн** / **Буцаах**; a wrong quantity: open the order → **Засах** |
| End of day | office | `/admin/ebarimt` | **Илгээгээгүй бүгдийг** (once PosAPI is in place) |
| End of day / week | office → accountant | `/admin/shipments` | the Dayansoft file for the days delivered |

Every correction is kept under the order ("Засварын түүх": who, when, why,
what changed), the store gets a notice with the old and new amount, and
the order shows what was first ordered.

## Running both for a while

- **One sale, one system.** An order entered in Mercury must not also be
  entered on the website, and the other way round — the delivery note, the
  e-Barimt and the accounting entry would all double.
- A practical split while e-Barimt still goes out through Mercury: keep
  orders that need a VAT receipt in Mercury, and use the website for the
  stores that already order in the app. Move everything on the day PosAPI
  works.
- Refresh the copy (step 2) every few days so prices and new customers
  match.

## The switch

1. Checklist on `/admin/mercury` all green except what you have decided to
   live without.
2. One last `npm run mercury:refresh -- --apply` after Mercury's last
   working day; then a full copy for the record:
   `npm run mercury:refresh -- --full`.
3. From the next morning every order goes into the website. Mercury stays
   readable (BDI's login still works until the subscription ends), and
   everything BDI ever had in it stays browsable under `/admin/mercury`.
4. Tell the accountant the day: from then on Dayansoft gets its sales from
   the website's file, not from Mercury.

## If something is wrong

- An order saved with a mistake: **Засах** on the order (any status but
  cancelled; return the e-Barimt first if one was sent).
- "Хүргэсэн" ticked by mistake on the dispatch board: **Буцаах** in the
  green message, within 10 minutes.
- A whole run closed too early: **Буцааж нээх** on the run (not once an
  e-Barimt was sent for one of its orders).
- Prices look wrong after a refresh: every `--apply` first writes a backup
  to `web/scripts/.mercury-data/import-backup-<time>.json`.
