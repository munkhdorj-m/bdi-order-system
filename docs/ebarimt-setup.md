# e-Barimt from the website — setup

The website builds each VAT receipt and puts it in a queue
(`/admin/ebarimt`). A small program, the **e-Barimt agent**
(`web/scripts/ebarimt-agent.mjs`), sends it to **PosAPI 3.0** and writes
the receipt number (ДДТД), lottery and QR back. It runs on a BDI computer
that stays on.

PosAPI 3.0 is a local service the tax office gives a registered merchant
(default `http://localhost:7080`). The website on Vercel can't reach it,
which is why the agent sits next to it.

```
/admin/ebarimt ──queue──▶ Supabase ◀──poll / write back── ebarimt-agent ──▶ PosAPI 3.0 ──▶ ebarimt.mn
```

## 1. What BDI needs from the tax office (one-time)

Today Mercury's vendor (BTGT) sends BDI's receipts through *their*
PosAPI. Sending from the website needs **BDI's own PosAPI 3.0**,
registered to BDI's ТТД:

1. Install PosAPI 3.0 (PosService) on an always-on computer. Use the
   installer and instructions from ebarimt.mn / the tax office.
2. Open `http://127.0.0.1:7080` on that computer and note the POS number.
3. Link it to BDI. The exact screens may differ, so confirm with the tax
   office:
   - On the ebarimt.mn business portal: Хүсэлт → Pos Api хүсэлт →
     Операторын холболт.
   - On the operator side: add BDI's ТТД as a merchant.
4. Try it on the **test** system first: stg-invoice.ebarimt.mn /
   st-operator.ebarimt.mn, using the demo merchant ТТД 37900846788.
   Switch to production only after test receipts work.

You'll end up with: **BDI's ТТД** (11–12 digits), the **district code**
(4 digits) and **branch number** used in the registration.

> ⚠ **Never issue the same sale twice.** While Mercury is still in use,
> each sale must get its e-Barimt from **one** place only. If an order is
> entered in both Mercury and the website, send its receipt from only one
> of them.

## 2. Run the agent on that computer

You need Node.js 18 or newer, plus a copy of `web/scripts/ebarimt-agent.mjs`.
Nothing else needs installing.

Make a file called `.env` next to the agent:

```
NEXT_PUBLIC_SUPABASE_URL=<same as web/.env.local>
SUPABASE_SERVICE_ROLE_KEY=<same as web/.env.local>
POSAPI_URL=http://localhost:7080
EBARIMT_MERCHANT_TIN=<BDI ТТД>
EBARIMT_DISTRICT_CODE=<4-digit code>
EBARIMT_BRANCH_NO=001
```

The service-role key gives full access to the website's database.
Keep this computer locked, and don't copy the `.env` file anywhere else.

Check it, then start it:

```
node --env-file=.env ebarimt-agent.mjs --check     # PosAPI info + database access
node --env-file=.env ebarimt-agent.mjs --dry-run   # print what would be sent, send nothing
node --env-file=.env ebarimt-agent.mjs             # keep running
```

To keep it running after a restart, use Windows Task Scheduler ("At
startup", restart on failure), NSSM, or systemd on Linux.
`/admin/ebarimt` shows a green "онлайн" banner while the agent and
PosAPI are up.

## 3. Daily use

1. Close the day's delivery runs (`/admin/dispatch` → Ачилт хаах). The
   orders become "Хүргэлтэнд гарсан".
2. `/admin/ebarimt` → **Илгээгээгүй бүгдийг**. Receipts queue, the agent
   sends them, and each row gets its ДДТД within seconds.
3. **Буцаах** returns a sent receipt (PosAPI `DELETE /rest/receipt`).
   After that the order can be sent again.

What the website sends:
- **Receipt type.** Stores with a registry number (7-digit company, or
  2 letters + 8 digits for a citizen) get a B2B receipt to their ТТД. The
  agent looks the ТТД up from the РД once and saves it on the store.
  Stores without a registry number get a B2C receipt with a lottery
  number.
- **Prices and VAT.** Prices include VAT, so an item's VAT is total ×
  10/110. Free gift lines are left out.
- **Cash discount.** The 2% cash discount is spread over the lines.
- **VAT-free goods.** They go in their own sub-receipt and need the tax
  office's product code (`products.ebarimt_tax_code`).
- **Classification code.** Each item carries its БҮНА code
  (`products.ebarimt_class_code`, copied from Mercury). 16 products have
  none yet.
- **Payment.** Sent as `CASH / PAID` for the full amount. Check with the
  accountant whether credit sales should be sent differently.

**If something goes wrong:**
- **PosAPI can't be reached.** The receipt waits in the queue and is
  retried.
- **PosAPI got the request but didn't answer.** The receipt is marked
  "Алдаа" instead of being resent, because resending blindly could create
  a duplicate. Check it in PosAPI, then press "Дахин илгээх".
