# Deployment — running BDI Захиалга at $0/month

This is the runbook for the Path 1 deployment: Vercel Hobby + Supabase
Free + Cloudflare front. Targets ~1000 users at $0/month. When you
outgrow it (DB hits ~400MB, or you want true commercial-use coverage)
you upgrade either side to Pro for ~$25/mo each.

The four moves in priority order are:

1. **Image optimization on upload** — code-level, already done in
   `web/src/app/admin/products/actions.ts`. Resizes uploads to ≤1200px
   and WebP-encodes them before they hit Supabase Storage. ~80% smaller
   than raw uploads.
2. **DB cleanup crons** — SQL-level, applied via
   `docs/fixes/25-cleanup-crons.sql`. Nightly deletes of read
   notifications and terminal orders keep the DB under 500MB
   indefinitely.
3. **Cloudflare in front of Vercel** — DNS-level, no code change.
   Caches static assets at Cloudflare's edge so end-user bandwidth
   doesn't count against Vercel's quota or Supabase Storage egress.
4. **Move product images to Cloudflare R2** — code-level, do this only
   when Supabase Storage exceeds the 1GB free tier (around 500–800
   products with full image coverage).

Items 1 and 2 are already in the codebase / fixes folder. The rest of
this doc is items 3 and 4.

---

## 3. Cloudflare in front of Vercel

This is a one-time DNS setup. Once done, Cloudflare caches your
assets globally and your Vercel + Supabase bandwidth usage drops
~10×.

### Prerequisites

- A registered domain (e.g. `bdi.mn`, `bdi-app.com`, etc.)
- The Vercel deployment is live (you have a `*.vercel.app` URL)

### Steps

1. **Sign up at [cloudflare.com](https://cloudflare.com)** — free plan
   is fine, never expires, no card required.

2. **Add your domain.** Cloudflare dashboard → "+ Add site" → paste
   your domain. Pick the Free plan.

3. **Update nameservers at your registrar.** Cloudflare gives you two
   nameservers (e.g. `bonnie.ns.cloudflare.com`,
   `carter.ns.cloudflare.com`). Go to wherever you bought the
   domain (Namecheap / GoDaddy / Cloudflare Registrar / etc.) and
   set those as the authoritative nameservers. Propagation takes
   1–24 hours.

4. **Point the domain at Vercel.** Inside Cloudflare DNS settings:
   - Delete any existing `A` / `CNAME` records for `@` and `www`.
   - Add a `CNAME` record:
     - **Name:** `@` (or your chosen subdomain like `app`)
     - **Target:** `cname.vercel-dns.com`
     - **Proxy status:** ✅ Proxied (orange cloud — this is the
       critical part; it enables Cloudflare's CDN in front of
       Vercel).
     - **TTL:** Auto

5. **Add the same domain inside Vercel.** Vercel project → Settings →
   Domains → Add → enter your domain. Vercel will verify ownership
   through the CNAME and provision an SSL cert.

6. **Make sure Cloudflare also has SSL on.** Cloudflare dashboard →
   SSL/TLS → Overview → set encryption mode to **Full (strict)**.
   This makes Cloudflare → Vercel use HTTPS, not plain HTTP, so the
   buyer's connection is end-to-end encrypted.

7. **Cache page rules.** Cloudflare dashboard → Caching → Cache Rules
   → Create rule:
   - **When incoming requests match:** URI Path → contains →
     `/_next/static/` (this is where Next.js puts its bundled
     JS/CSS, all hashed and cacheable forever)
   - **Then:** Cache eligibility → Eligible for cache
   - Edge TTL → Override origin → 1 year
   - Repeat for `/_next/image` (Next's image optimizer) and any
     other static prefix you care about.

8. **(Recommended) Cache Supabase Storage URLs.** Either:
   - Add another DNS record `CNAME` `cdn` → your Supabase project's
     storage host, proxied through Cloudflare. Then have the admin
     upload action write the public URL with your CDN domain
     instead of the raw `*.supabase.co` URL. End-user image
     downloads hit your Cloudflare edge instead of Supabase.
   - OR: defer this until you outgrow Supabase Storage and move
     everything to R2 (next section).

### Verify

After DNS propagates:

- `nslookup yourdomain.com` should show Cloudflare's IPs (typically
  starting with `104.21.x.x` or `172.67.x.x`), not Vercel's.
- Open your domain in a browser. Inspect any network request →
  Response headers → look for `cf-cache-status: HIT` on repeated
  requests to static assets. That's Cloudflare serving from edge
  cache.

---

## 4. Move product images to Cloudflare R2

Do this only when Supabase Storage hits ~80% of the 1GB free quota.
At 500 products × ~150KB optimized images = ~75MB, you've got headroom
for thousands of products before this matters. The signal to migrate
is the "Storage usage" warning in your Supabase dashboard.

### Why R2

- **10GB free storage** (10× Supabase free tier)
- **No egress fees** — unlike S3, you pay $0 for traffic out, even
  petabytes
- **S3-compatible API** — same SDK shape as `@aws-sdk/client-s3`, so
  the migration is mostly URL changes

### Steps

1. **Create an R2 bucket.** Cloudflare dashboard → R2 → Create bucket
   → name it e.g. `bdi-product-images` → choose your jurisdiction
   (`Asia-Pacific` is the closest region to Mongolia).

2. **Set the bucket public.** R2 bucket → Settings → Public access →
   Allow public access. Note the public URL Cloudflare gives you
   (e.g. `https://pub-xxxxx.r2.dev/bdi-product-images`). You can
   also map it to a subdomain like `cdn.bdi.mn` later via the same
   DNS setup above.

3. **Get API credentials.** R2 → Manage R2 API Tokens → Create token
   → permission "Object Read & Write" on this bucket only. Note the
   Access Key ID and Secret. These go into your Vercel env vars:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=bdi-product-images
   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev/bdi-product-images
   ```

4. **Update the upload action.** Replace the Supabase `.storage.from()
   .upload()` call in `web/src/app/admin/products/actions.ts` with an
   S3 PutObjectCommand pointed at R2. The sharp resize/encode pipeline
   stays exactly the same. Sketch:

   ```ts
   import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

   const r2 = new S3Client({
     region: "auto",
     endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials: {
       accessKeyId: process.env.R2_ACCESS_KEY_ID!,
       secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
     },
   });

   await r2.send(new PutObjectCommand({
     Bucket: process.env.R2_BUCKET!,
     Key: path,
     Body: optimized,
     ContentType: "image/webp",
     CacheControl: "public, max-age=31536000, immutable",
   }));

   const publicUrl = `${process.env.R2_PUBLIC_URL}/${path}`;
   ```

5. **Add the R2 domain to next.config.ts remotePatterns.** Otherwise
   Next image optimization rejects images from this new origin.

6. **Migrate existing images.** Either:
   - Re-upload each product image from the admin UI (slow but
     trivially correct), OR
   - Write a one-shot migration script that streams every object
     from Supabase Storage and PUTs it into R2 with the same key,
     then updates `products.image_url` in bulk.

### Verify

- Upload a new product image as admin → confirm the resulting
  `products.image_url` points at the R2 public URL.
- Open the URL in a browser → image loads, response headers show
  Cloudflare's `cf-ray` header.
- Check R2 dashboard → bucket → objects → new image appears with
  WebP MIME type and ~100-200KB size.

---

## Cost projection

With Path 1 fully applied at 1000 buyer accounts:

| Service | Free quota | Expected use | Headroom |
|---|---|---|---|
| Supabase DB | 500 MB | ~150 MB (after crons) | 3× |
| Supabase Bandwidth | 5 GB/mo | ~1 GB (after Cloudflare) | 5× |
| Supabase Storage | 1 GB | ~75 MB (after sharp) | 13× |
| Vercel Bandwidth | 100 GB/mo | ~2 GB (after Cloudflare) | 50× |
| Vercel Functions | 100K/day | ~20K/day | 5× |
| Cloudflare CDN | unlimited | unlimited | — |
| R2 Storage (when needed) | 10 GB | ~75 MB | 130× |

Total: **$0/month** until you cross ~5000 active users.

---

## When to upgrade

| Signal | Action |
|---|---|
| Supabase dashboard "DB usage" >80% | Upgrade to Supabase Pro ($25/mo) OR tighten the cleanup crons |
| Vercel dashboard "Bandwidth" >80% | Upgrade to Vercel Pro ($20/mo) — usually means Cloudflare cache is missing |
| Errors of "Too many connections" | Supabase Pro raises the pooler limit |
| Auth signup rate-limited (30/hr) | Upgrade to Supabase Pro (300/hr) |
| You start invoicing customers and care about Vercel's commercial-use clause | Upgrade to Vercel Pro ($20/mo) for above-board commercial use |

Past that, the only architectural change worth doing at scale (10K+
active users) is moving Postgres off Supabase to a dedicated host
(Hetzner, AWS RDS, or self-hosted on Oracle Always Free). Until then,
the stack above is correct.
