# verify.mn integration — manual test plan

The project doesn't have a Vitest/Jest runner installed (deliberately
— per CLAUDE.md "do not add new dependencies unless required"). This
doc is the canonical checklist for verifying the verify.mn phone-
verification pipeline before each release.

## Setup

1. Apply the SQL migration in the Supabase SQL editor:
   ```
   docs/fixes/26-verify-mn-sessions.sql
   ```
   This adds the `verify_mn_sessions` table and drops the legacy
   `phone_otp` table. Idempotent — safe to re-run.

2. Set the env var in Vercel → Project Settings → Environment Variables
   (or locally in `web/.env.local`):
   ```
   VERIFY_MN_API_KEY=<your_key_from_the_verify.mn_dashboard>
   ```
   Mark sensitive in Vercel so it stays out of build logs.

3. Confirm `NEXT_PUBLIC_SITE_URL` matches the deployed origin
   (e.g. `https://your-app.vercel.app`). The phone-register action
   uses it as the verify.mn callback URL — verify.mn rejects callbacks
   that aren't HTTPS.

4. Deploy. Open the deployed URL on your **phone** (the flow uses
   `sms:` URIs that only work on devices with a SIM).

## Test cases

### T1 — happy path (PENDING → VERIFIED)

**Goal:** confirm a real phone can register end-to-end.

Steps:

1. Navigate to `/register/phone`
2. Enter:
   - Овог нэр: any name
   - Утасны дугаар: a Mongolian mobile you control (8 digits, e.g. `99112233`)
   - Нууц үг: any password ≥ 8 chars (e.g. `Test1234`)
   - Нууц үг давтах: same
3. Tap **Үргэлжлүүлэх**
4. Verify redirect to `/register/phone/verify?session=...`
5. Verify the page shows:
   - SMS илгээх tap-link
   - The 6-digit code in a copy-friendly chip
   - "144773 руу <code> гэсэн мессеж илгээнэ үү" instruction
6. Tap **SMS илгээх** → confirm your SMS app opens pre-filled with the
   code aimed at 144773
7. Send the SMS
8. Wait. Within ~3-7 seconds the poller should detect VERIFIED state
9. Verify automatic redirect to `/login?success=phone-verified`
10. Try logging in with the phone + the password you set

Expected DB state (Supabase SQL editor):
```sql
SELECT session_id, phone, verified, verified_at FROM verify_mn_sessions
ORDER BY created_at DESC LIMIT 1;
-- verified = true
-- verified_at = recent timestamp
```

### T2 — expiry timeout (PENDING → EXPIRED)

**Goal:** confirm a session that never receives the SMS times out and
the user can recover.

Steps:

1. Start a registration as in T1, all the way through to the verify page
2. **Don't send the SMS.** Walk away for 5 minutes.
3. After ~5 minutes the poller should detect EXPIRED state
4. Verify the page redirects to `/register/phone` with a "Сессийн
   хугацаа дууссан" error toast

Alternative (faster): in the SQL editor, set `expires_at` manually to
a past timestamp and watch the next poll detect it:
```sql
UPDATE verify_mn_sessions
SET expires_at = now() - interval '1 minute'
WHERE session_id = '<your session id>';
```

### T3 — bad API key (401)

**Goal:** confirm a misconfigured `VERIFY_MN_API_KEY` produces a
user-friendly error rather than crashing the form.

Steps:

1. In Vercel env vars, temporarily set
   `VERIFY_MN_API_KEY=intentionally_broken`
2. Redeploy
3. Navigate to `/register/phone` and submit the form with valid name +
   phone + password
4. Expected:
   - **Redirect** back to `/register/phone` with a Mongolian error
     message (not the raw verify.mn response)
   - Server logs show `[verify.mn] 401 unauthorized — VERIFY_MN_API_KEY rejected`
   - The API key string itself **does NOT appear** in any log or
     redirect URL
5. Restore the real key and redeploy

### T4 — callback receipt

**Goal:** confirm verify.mn's callback hits our route and flips the
row.

Steps:

1. Start a registration as in T1, send the SMS
2. Tail your Vercel function logs (CLI: `vercel logs --follow`) and
   look for a GET on `/api/verify-mn/callback/<sessionId>` returning
   200 within a few seconds of the SMS landing
3. Within ~3 seconds after the callback, the next poll should report
   `verified=true` from our DB (fast-path) rather than calling
   verify.mn again

### T5 — polling rate limit

**Goal:** confirm we don't hammer verify.mn faster than the 3s floor.

Steps:

1. Start a verification, leave the verify page open
2. In Chrome DevTools → Network tab, filter for
   `/api/verify-mn/poll/`
3. Confirm requests fire at ~3.5s intervals (not faster)
4. If you ever see a 429 response, the poll endpoint should return
   `verified=false` with `retryAfterMs` ≥ 3000, and the next request
   should be at least that far out

### T6 — phone format validation

**Goal:** confirm bad phone numbers are rejected before any verify.mn
call is made (saves cost).

Steps:

1. Try submitting `/register/phone` with each of:
   - `12345678` (doesn't start with 6/7/8/9) → expect "буруу" error
   - `9911` (too short) → expect "буруу" error
   - `+97699112233` → expect SUCCESS (already E.164)
   - `99 11 22 33` (spaces) → expect SUCCESS (normalized)
2. Confirm none of these created a row in `verify_mn_sessions` for the
   invalid cases

## Cleanup

After testing, delete test rows:
```sql
DELETE FROM verify_mn_sessions
WHERE phone LIKE '+97699112233';  -- replace with your test number
```
