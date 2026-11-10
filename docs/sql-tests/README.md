# SQL tests

SQL for the live database is run by hand in the Supabase SQL editor, so a
mistake goes straight to production. This folder lets a change be tried
first on a local copy of the schema.

- `harness.mjs` rebuilds the database inside [PGlite](https://pglite.dev)
  (real Postgres, in-process): `schema-before-fix-39.sql` + every file in
  `../fixes` up to a number, with small stand-ins for the Supabase parts
  (the `anon` / `authenticated` / `service_role` roles, `auth.uid()`,
  storage, pg_cron). `asUser()` runs a query the way a signed-in user's
  request would (role + JWT claims), so access rules are really exercised.
- `seed.mjs` is the test data: an admin, a switched-off admin, a rep, two
  stores with their accounts, products, prices and two orders.
- `test-fix42.mjs` is the test for `../fixes/42-all-pending-in-one.sql`:
  what an admin, a switched-off admin, a store, a rep, a new sign-up, an
  anonymous visitor and the server can each see and do, before and after;
  that running it twice changes nothing; and that a failed check undoes
  everything.
- `test-order-writer.mjs` runs the site's own order writer
  (`web/src/lib/orders/write.ts`) against that database: a normal send, the
  same send arriving again, a send that dies between the order and its
  lines, and two sends at the same moment. One checkout must make one
  order, with its lines written once. (It reads TypeScript from
  `web/node_modules`, so run `npm install` in `web/` first.)

```bash
cd docs/sql-tests
npm install
npm test
```

It is a rebuild from the files in this repo, not a copy of production: a
rule changed by hand in the Supabase dashboard would not be in it. Fix 42
therefore also tests itself on the live database before it commits.

For a new SQL file: copy `test-fix42.mjs`, point it at the new file, and
write down what each kind of user must still be able to do — and must not.
