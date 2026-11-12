#!/usr/bin/env node
/**
 * Catch the website up with Mercury — one command
 * ===============================================
 * While Mercury is still the live system, prices, price lists, customers
 * and products keep changing there. This runs the two steps that bring the
 * website level again:
 *
 *   1. mercury-sync.mjs --quick   copy the latest from Mercury (a few minutes;
 *                                 read-only toward Mercury, as always)
 *   2. mercury-import.mjs         work out what that changes on the website
 *
 * From web/:
 *   npm run mercury:refresh              copy, then SHOW what would change (nothing is written
 *                                        to the catalog — read the summary first)
 *   npm run mercury:refresh -- --apply   copy, then apply it: prices, price lists, new stores,
 *                                        new products (visible if Mercury's phone app shows them).
 *                                        Backs every touched table up first.
 *   npm run mercury:refresh -- --full    copy ALL of Mercury again (every month since 2023 and
 *                                        every customer card — about 20 minutes) instead of --quick
 *
 * Stock is never taken from Mercury (it isn't kept up there). New products
 * arrive with stock 0 = "Дууссан" for stores: give them stock on
 * /admin/products → "Үлдэгдэлгүй".
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KNOWN = new Set(["--apply", "--full", "--help", "-h"]);

function run(script, args) {
  console.log(`\n▶ ${script} ${args.join(" ")}\n`);
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: "inherit", env: process.env });
  if (r.error) {
    console.error(`\n✗ Could not start ${script}: ${r.error.message}`);
    return 1;
  }
  return r.status ?? 1;
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    "Usage: npm run mercury:refresh [-- --apply] [-- --full]\n\n" +
      "  (no option)  copy the latest from Mercury, then show what would change on the website\n" +
      "  --apply      …and apply it (backs up first)\n" +
      "  --full       copy all of Mercury again instead of the quick copy",
  );
  process.exit(0);
}
for (const a of argv) {
  if (!KNOWN.has(a)) {
    console.error(`Unknown option ${a} (try --help)`);
    process.exit(1);
  }
}
if (!process.env.MERCURY_USERNAME || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Settings missing — run it as `npm run mercury:refresh` from web/ (it reads .env.local).");
  process.exit(1);
}

const apply = argv.includes("--apply");
const copied = run("mercury-sync.mjs", argv.includes("--full") ? [] : ["--quick"]);
if (copied !== 0) {
  // Applying prices from a copy that stopped half-way could move stores to the wrong list.
  console.error(
    "\n✗ The copy from Mercury did not finish cleanly (see above), so nothing was changed on the website.\n" +
      "  Run it again; if the same error comes back, it needs a look before applying anything.",
  );
  process.exit(copied);
}

const imported = run("mercury-import.mjs", apply ? ["--apply", "--activate-new"] : []);
if (imported !== 0) process.exit(imported);

console.log(
  apply
    ? "\n✓ The website is level with Mercury. New products have stock 0 — /admin/products → «Үлдэгдэлгүй» to make them orderable."
    : "\n✓ Copied. The list above is what WOULD change — nothing was written to the catalog.\n" +
        "  To apply it:  npm run mercury:refresh -- --apply",
);
