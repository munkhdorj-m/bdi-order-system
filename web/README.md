# BDI Захиалга — web app

Wholesale ordering for BDI: stores order on their phones, sales reps order
on a store's behalf, and the office confirms, dispatches, prints and issues
e-Barimt. Next.js 16 (App Router) + React 19 + Supabase + Tailwind v4.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Checks before pushing:

```bash
npm run typecheck    # source only (ignores Next's generated files)
npm run lint
npm run build        # stop `npm run dev` first: both write under .next/
```

## Environment (`.env.local`, never committed)

| Name | What for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only writes (orders, sign-up, notifications). Never expose. |
| `NEXT_PUBLIC_SITE_URL` | Public URL for SMS/verify links |
| `VERIFY_MN_API_KEY` | Phone verification (verify.mn) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Staff alerts |
| `NEXT_PUBLIC_BDI_*` | Contact links shown to stores |
| `MERCURY_USERNAME`, `MERCURY_PASSWORD` | Read-only Mercury (app.gps.mn) mirror scripts |

## Where things live

```
src/app/(buyer)/     store app: catalog, cart, orders, contact
src/app/rep/         sales-rep app: stores, cart per store, orders
src/app/admin/       office: orders, dispatch, shipments, e-Barimt, prices, users…
src/app/print/       delivery notes and loading lists
src/lib/orders/      the ONLY place store/rep orders are written (service role)
src/lib/discount.ts  deal engine shared by catalog, cart and server
src/lib/dispatch.ts  Ulaanbaatar-day helpers (the server runs in UTC)
src/lib/datetime.ts  date formatting ("2026.11.08", "11.08 13:05")
src/components/ui/   design-system primitives (Button, Card, Select…)
scripts/             Mercury mirror/import, e-Barimt agent
../docs/fixes/       numbered SQL changes for the live database
```

## Rules of the road

- **Who can write what.** Stores and reps only *read* orders in the
  database; every order write goes through `src/lib/orders/` after the
  server has checked the user, the store and the prices.
- **Every server action checks rights itself** (`adminGuardError()`,
  `hasActiveRole()` in `src/lib/auth.ts`). Layouts don't protect actions.
- **1,000-row limit.** Supabase returns at most 1,000 rows per request,
  silently. Use `fetchAll` (`src/lib/supabase/fetch-all.ts`) for anything
  that can grow.
- **Shared, cached lists.** The full store list (pickers, suggestions) is
  read once and shared between requests (`src/lib/stores.ts`, tag
  `stores`); any action that changes a store calls `updateTag(STORES_TAG)`.
- **Search is in the browser.** The catalog filters the products already
  on the page (`src/components/catalog/catalog-search.tsx`), Latin or
  Cyrillic; there is no search request.
- **Time zone.** Business days are Ulaanbaatar days (UTC+8). Use the
  helpers in `src/lib/dispatch.ts` and `src/lib/datetime.ts`, never
  `toISOString().slice(0, 10)`.
- **Design ("Тэнгэр ба алт 2.0").** Tokens in `src/app/globals.css`:
  cobalt `primary` for navigation/confirm, `gold` for shopping actions,
  `shadow-card` / `shadow-raised` / `shadow-float` for depth, `.field` and
  `.chip` for form controls and filters, Onest for text and Montserrat for
  titles and prices.

## Database changes

SQL lives in `../docs/fixes/NN-*.sql`, run by hand in the Supabase SQL
editor in number order. Each file says whether to run it before or after
deploying the matching code. `42-all-pending-in-one.sql` bundles 39-41
plus the access-rule speed-up and tests itself before it commits.

Try a SQL change locally first: `../docs/sql-tests` rebuilds the schema in
PGlite (in-process Postgres) and checks what each kind of user can see and
do (`cd ../docs/sql-tests && npm install && npm test`). The same run puts
the order writer (`src/lib/orders/write.ts`) through re-sent, half-sent and
simultaneous checkouts — run it after touching that file.
