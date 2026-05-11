# BDI B2B Ordering App

Web/mobile app that lets BDI's supermarket customers (and sales reps) place orders directly, replacing the manual rep-visit workflow.

## Status

**Design approved.** Schema and wireframes locked. Ready to scaffold the Next.js app (Path A).

## Locked decisions

- **Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres + Auth + Storage) on Vercel
- **Roles:** admin (BDI staff), rep (sales rep), buyer (supermarket buying manager)
- **Auth:** phone + SMS OTP (Mongolia / +976)
- **Currency:** MNT
- **Pricing:** per-supermarket override on top of a wholesale base price
- **Cash price:** stored in DB, **shown to admin only** — not displayed in the buyer/rep catalog (no payment-method picker in v1)
- **Reps:** view-only on prices (cannot edit / negotiate in-app)
- **Mobile strategy:** PWA, not native — defer native app until adoption proven

## Documents to review

| File | What it is |
|---|---|
| [`docs/schema.sql`](docs/schema.sql) | Full Supabase migration: 7 tables, RLS policies, triggers, helper view, seeded categories. Ready to paste into the Supabase SQL editor. |
| [`docs/wireframes.md`](docs/wireframes.md) | Text-art layout for every screen across buyer, admin, and rep flows. |

## Next steps

1. **Sign up for Supabase** (free tier) — create a new project named `bdi-b2b`.
2. **Configure Twilio SMS** in Supabase Auth for +976 numbers.
3. **Run `docs/schema.sql`** in the Supabase SQL editor.
4. **Scaffold the Next.js app** (Path A) — Claude will set this up in `./web/`.
5. **Phase 1 build:** auth + role routing.
6. Continue with phases 2–6 from the plan.

## Project structure (planned)

```
bdi b2b/
├── README.md             ← you are here
├── docs/
│   ├── schema.sql        ← Supabase migration
│   └── wireframes.md     ← screen layouts
├── web/                  ← Next.js app (created in Path A)
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
└── scripts/
    └── import_xlsx.py    ← one-time product import (Phase 2)
```

## Catalog import note

The source `Барааны CG бүх барааны жагсаалт Бэлний бөөн 202601.xlsx` will be imported in Phase 2. Known data fixes needed first:

- Duplicate barcode `6950562935699` appears on 3+ different detox patch SKUs — needs unique barcodes or generated SKUs.
- Some barcodes have stray `\n` whitespace — the import script will strip these.
- No product images in the file — admin will upload these via the UI.
