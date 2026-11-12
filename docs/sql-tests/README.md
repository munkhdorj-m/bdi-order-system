# SQL tests

SQL for the live database is run by hand in the Supabase SQL editor, so a
mistake goes straight to production. This folder lets a change be tried
first on a local copy of the schema — and runs the website's own order
code against that copy.

```bash
cd docs/sql-tests
npm install
npm test
```

(The tests that run website code read TypeScript from `web/node_modules`,
so run `npm install` in `web/` first.)

## What is here

| File | What it is |
| --- | --- |
| `harness.mjs` | Rebuilds the database inside [PGlite](https://pglite.dev) (real Postgres, in-process): `schema-before-fix-39.sql` + every file in `../fixes` up to a number, with small stand-ins for the Supabase parts (the `anon` / `authenticated` / `service_role` roles, `auth.uid()`, storage, pg_cron). `asUser()` runs a query the way a signed-in user's request would, so access rules are really exercised. |
| `seed.mjs` | The test data: an admin, a switched-off admin, a rep, two stores with their accounts, products, prices and two orders. |
| `load-ts.mjs` | Loads a module from `web/src` into a test, so the tests run the code that ships. |
| `fake-supabase.mjs` | A Supabase-shaped client that answers with real SQL on the test database, with hooks to fail, hold or kill a request at a chosen point. |

## The tests

| File | What it proves |
| --- | --- |
| `test-fix42.mjs` | `../fixes/42-all-pending-in-one.sql`: what an admin, a switched-off admin, a store, a rep, a new sign-up, a visitor and the server can each see and do, before and after; twice is harmless; a failed check undoes everything. |
| `test-fix43.mjs` | `../fixes/43-mercury-replacement.sql`: the same for the order-correction function, its history table and the delivery-person link. |
| `test-order-writer.mjs` | `web/src/lib/orders/write.ts`: one checkout makes one order with its lines written once — the same send again, a send that dies half-way, two sends at the same moment. |
| `test-order-correction.mjs` | `web/src/lib/orders/correction.ts` + `correct.ts`: correcting an order after it was placed — quantities, a product off or added, deals that follow, the history, and everything that must be refused. |
| `test-delivery-access.mjs` | `web/src/lib/delivery-runs.ts`: only the run's own delivery person can open an order on the delivery screen. |
| `test-dayansoft.mjs` | `web/src/lib/dayansoft.ts`: the sales file for the accounting system has Dayansoft's exact columns and the right amounts on each line. |

It is a rebuild from the files in this repo, not a copy of production: a
rule changed by hand in the Supabase dashboard would not be in it. Fixes 42
and 43 therefore also test themselves on the live database before they
commit.

For a new SQL file: copy `test-fix43.mjs`, point it at the new file, and
write down what each kind of user must still be able to do — and must not.
