# Admin notifications — setup

Alerts admins on their phone and desktop when something needs attention.
Both channels are **free and unlimited** — no per-message cost, ever.

| Channel | Cost | Reaches |
|---|---|---|
| **Web Push** (VAPID) | ₮0 — self-hosted, no third party | Android Chrome, desktop Chrome/Edge/Firefox, iPhone *(after Home Screen install)* |
| **Telegram bot** | ₮0 — unlimited | Any phone + desktop with Telegram, no install caveats |

They're deliberately redundant. Web Push feels native but has two real holes:
iPhone requires the site be added to the Home Screen first, and any browser may
evict the service worker if the PWA sits unopened for weeks. Telegram has
neither problem. Running both means an alert has to fail twice to be missed.

---

## What triggers an alert

| Event | Who gets it | Channels |
|---|---|---|
| Buyer places an order | every active admin | in-app + push + Telegram |
| Buyer cancels an order | every active admin | in-app + push + Telegram |
| **New signup finishes phone verification** | every active admin | in-app + push + Telegram |
| Admin approves a user | that buyer | in-app + push |
| Order status changes | that buyer | in-app + push |
| New discount goes live | every active buyer | in-app + push |

The new-signup alert is new. Before this, a verified signup sat silently in
`/admin/users` until somebody thought to look — while the buyer stared at the
"pending approval" screen.

---

## Step 1 — Run the migration

Paste [`docs/fixes/34-push-notifications.sql`](fixes/34-push-notifications.sql)
into the Supabase SQL editor and run it. It's idempotent — safe to re-run.

It adds the `push_subscriptions` table (one row per device) and two new
notification kinds (`user_pending`, `order_cancelled`).

Verify:

```sql
select unnest(enum_range(null::notification_kind));
```

You should see six values including `user_pending` and `order_cancelled`.

---

## Step 2 — Web Push keys (VAPID)

A keypair has already been generated and written to `web/.env.local`, so
**local dev works right now**. For production, generate a *separate* pair:

```bash
npx web-push generate-vapid-keys
```

Add all three to **Vercel → Project Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key — mark **Sensitive** |
| `VAPID_SUBJECT` | `mailto:your-real-email@bdi.mn` |

> Don't rotate these once admins have subscribed. Changing the public key
> invalidates every existing subscription and every device goes quiet until
> each admin toggles notifications off and on again.

---

## Step 3 — Telegram bot

About two minutes, once.

1. Open Telegram, message **@BotFather**, send `/newbot`.
   Give it a name (e.g. `BDI Захиалга`) and a username ending in `bot`.
   BotFather replies with a token like `8123456789:AAH...` → that's
   `TELEGRAM_BOT_TOKEN`.

2. Create a Telegram group (e.g. "BDI Захиалга — админ"), add every admin,
   and **add your new bot as a member**.

3. In the group, send `/start@YourBotName` (your bot's username). A plain
   message like "hi" won't work: bots have *privacy mode* on by default and
   never see ordinary group messages, only commands addressed to them. Then
   open this URL in a browser (it contains your token — don't screenshot or
   share it):

   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```

   Find the entry whose `"type"` is `"group"` or `"supergroup"`, e.g.
   `"chat":{"id":-5238060644,"title":"BDI Orders","type":"group"}`. That
   **negative** `id` is `TELEGRAM_CHAT_ID`.

   > Don't use an entry with `"type":"private"`. That's your own chat with the
   > bot, and its ID is a positive number — using it sends every alert to your
   > private messages instead of the group.

4. Add both to `.env.local` and to Vercel, then **redeploy**. Vercel only
   applies changed environment variables to new deployments.

`TELEGRAM_CHAT_ID` accepts a comma-separated list — a group plus individual
admins works without any code change:

```
TELEGRAM_CHAT_ID=-1001234567890,987654321
```

### If alerts have no "open" button

Each alert carries a button (e.g. **Захиалга харах**) that opens the order or
user page. Alerts sent while testing locally have no button: Telegram won't
link to `localhost` or a LAN address. On the live site the button uses
`NEXT_PUBLIC_SITE_URL`, or Vercel's production domain if that isn't set to a
public address.

### If alerts arrive in your private chat instead of the group

`TELEGRAM_CHAT_ID` holds your own chat ID (a positive number) instead of the
group's. Redo step 3 and use the entry with `"type":"group"`.

### If the group stops getting alerts later

Telegram converts a group into a *supergroup*, with a **new ID**, when you
change some settings (for example making it public, or making chat history
visible to new members) or it grows past 200 members. A plain group ID looks
like `-5238060644`; a supergroup ID looks like `-1001234567890`. Vercel's
function logs will show `group chat was upgraded to a supergroup chat` along
with the new ID — put that in `TELEGRAM_CHAT_ID` and redeploy.

If `getUpdates` shows nothing for the group, check the bot is still a member
and send `/start@YourBotName` there again. Updates expire after 24 hours.

---

## Step 4 — Admins turn on their devices

Each admin opens **/notifications** and taps **"Мэдэгдэл асаах"**. This is
per-device on purpose — turning it on at the office desktop shouldn't silence
the phone. Repeat on every device that should ring.

**Android / desktop:** grant the browser permission prompt. Done.

**iPhone:** Safari refuses to expose push to a normal tab. The admin must first
tap **Share → Add to Home Screen**, then open the app *from the Home Screen
icon* and toggle it on there. The UI detects this case and shows the
instruction rather than a dead button.

---

## Testing

Run the dev server **from `web/`**, not the repo root:

```bash
cd web
npx next dev --experimental-https
```

From the root, `npx` can't find the project's Next install, quietly downloads
the latest Next instead, and fails with *"Couldn't find any `pages` or `app`
directory"*. The first HTTPS run creates `web/certificates/` and appends a
`certificates` line to `web/.gitignore` — commit that line; it keeps the local
private key out of git.

On the PC, `https://localhost:3000` works for push. (So does plain
`npm run dev` on `http://localhost:3000` — browsers treat localhost as a secure
origin.)

**Phones can't test push against the dev server.** The "Network" URL Next
prints (e.g. `https://192.168.x.x:3000`) uses a certificate only your PC
trusts, and browsers won't register a service worker on a page with a
certificate error. Test phones against the deployed Vercel site instead.

Then:

1. Sign in as an admin, open `/notifications`, enable notifications.
2. In another browser (or a private window) sign in as a buyer and place an
   order.
3. The admin should get an OS notification, a Telegram message, and a bell
   badge.

Check delivery state in SQL:

```sql
select p.full_name, p.role, count(s.id) as devices
from public.profiles p
left join public.push_subscriptions s on s.user_id = p.id
where p.role = 'admin'
group by p.id, p.full_name, p.role;
```

---

## How it fits together

Everything funnels through `notify()` / `notifyMany()` in
[`web/src/lib/notify.ts`](../web/src/lib/notify.ts) — that single choke point is
why push could be added without changing any call site's logic:

```
placeOrder ─┐
cancelOrder ─┼─→ notifyMany() ─┬─→ notifications table  (in-app bell)
newSignup  ─┘                  ├─→ lib/push.ts          (Web Push, per user)
                               └─→ lib/telegram.ts      (staff chat, once)
```

Telegram fires **once** per event regardless of recipient count — it's one
shared chat, so fanning it out would post the same order N times. Push and the
in-app row go to each recipient.

Every channel swallows its own errors. A Telegram outage or an expired push
subscription can never break an order.

### Files

| File | Role |
|---|---|
| `docs/fixes/34-push-notifications.sql` | `push_subscriptions` table + new kinds |
| `web/src/lib/notify.ts` | fan-out choke point |
| `web/src/lib/push.ts` | VAPID send, prunes dead subscriptions |
| `web/src/lib/telegram.ts` | Bot API send |
| `web/public/sw.js` | service worker — receives push, handles taps |
| `web/src/components/push-toggle.tsx` | per-device opt-in UI |
| `web/src/app/notifications/actions.ts` | save/delete subscription |

---

## Notes

- **Dead subscriptions self-clean.** When a push service returns 404/410 Gone
  (site data cleared, PWA uninstalled), `push.ts` deletes the row immediately —
  no cron job needed.
- **Push payloads are encrypted** with the subscription's own keys, so Google,
  Apple, and Mozilla relay ciphertext they can't read.
- **Both channels degrade cleanly.** Leave the env vars blank and that channel
  silently no-ops; the in-app bell keeps working.
- **`/sw.js` is served with `no-cache`** (see `next.config.ts`). Without that, a
  CDN-cached service worker would pin every admin's device to the first version
  ever shipped.

## If you later want SMS

SMS is the one channel that costs money — roughly 20–50₮ per message through a
Mongolian gateway. Given push and Telegram cover phone and desktop for free,
it's only worth adding as a last-resort escalation (e.g. an order sitting
unconfirmed for two hours). The `notify()` choke point is where it would go.
