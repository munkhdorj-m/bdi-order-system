#!/usr/bin/env node
/**
 * Mercury mirror → BDI website tables
 * ===================================
 * Turns the verbatim Mercury copy (mercury_records, filled by
 * mercury-sync.mjs) into the website's own catalog: products, price lists
 * and their prices, stores with Mercury's price-list assignment, and the
 * fields the website needs to replace Mercury (e-Barimt codes, VAT flags,
 * store registry numbers, receivables).
 *
 * DRY RUN BY DEFAULT: prints what would change and writes the full plan to
 * scripts/.mercury-data/import-plan-<time>.json. Nothing is written unless
 * you pass --apply, and an apply first backs up every table it touches to
 * scripts/.mercury-data/import-backup-<time>.json.
 *
 * Mercury is the source of truth for prices and price-list assignment; the
 * website keeps what it curates:
 *   products     linked by Mercury id, else barcode AND name — Mercury reuses
 *                barcodes across different products. Updates base price, box
 *                count, VAT flags and e-Barimt codes; never name, photo,
 *                description or active. Category only when a product has
 *                none: Mercury's category → the website category listing it
 *                in categories.mercury_ids (fix 38). New Mercury products are
 *                added hidden (active = false) unless --activate-new.
 *                Stock only with --sync-stock (stock <= 0 blocks ordering).
 *   price lists  linked by Mercury id, else same name, else a website list
 *                whose prices agree; the rest are created. Website-only lists
 *                are left alone.
 *   list prices  = Mercury's. A 0 in Mercury means "no special price", so the
 *                website row is removed and the store pays the base price.
 *   stores       linked by external_id (= Mercury registration number).
 *                Registry no., location, receivable and discount come from
 *                Mercury; name/type/district/address/phone only fill blanks.
 *                New active Mercury customers are added.
 *   store price  decided by what Mercury actually INVOICED the store, not by
 *   list         Mercury's "Гэрээний үнэ" field: that field is mostly left at
 *                "Үндсэн үнэ" while reps bill a list (every Nomin branch is
 *                "base" yet was billed Номин prices). Per store, the list that
 *                best explains its last 6 months of invoice lines (≥3 lines,
 *                ≥60% exact matches) wins; without enough evidence an existing
 *                store keeps its website list and a new one gets the contract
 *                list. Stores on a website-only list keep it. The plan reports
 *                how often the website would charge exactly what Mercury
 *                invoiced, before and after.
 *   overrides    --purge-store-overrides deletes the per-store prices the old
 *                keyword import bulk-created on one day (default 2026-05-12),
 *                which otherwise outrank every price list. Hand-edited ones stay.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/mercury-import.mjs
 *   node --env-file=.env.local scripts/mercury-import.mjs --apply --purge-store-overrides
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, ".mercury-data");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "1,356,980" / "35 ш" / "0.00%" → number (0 when blank or unparseable). */
export const num = (v) => {
  const n = Number(String(v ?? "").replace(/[,\s₮%]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** First integer in a string ("35 ш" → 35), or null. */
export const int = (v) => {
  const m = String(v ?? "").match(/-?\d+/);
  return m ? Number(m[0]) : null;
};

const norm = (s) => String(s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const blank = (v) => v == null || String(v).trim() === "";

function trigrams(s) {
  const t = ` ${String(s ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  const out = new Set();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

/** Dice similarity of character trigrams — tolerant of Mongolian suffixes ("хоргүйжүүлж" / "хоргүйжүүлэх"). */
export function similarity(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  let shared = 0;
  for (const x of A) if (B.has(x)) shared++;
  return A.size + B.size ? (2 * shared) / (A.size + B.size) : 0;
}

/**
 * Link website products to Mercury products.
 *
 * 1. An existing mercury_id link wins.
 * 2. Otherwise candidates share the barcode family (the website suffixed
 *    duplicate barcodes "-2", "-3"…), scored by name similarity, assigned
 *    greedily best-first so each Mercury product links at most once — that is
 *    what keeps the four detox patches on one barcode, or Mercury's tissue box
 *    vs patch on another, from crossing.
 * 3. Whatever is left gets a name-only suggestion, reported but never applied
 *    — unless a person confirms it with --link <website sku>=<mercury id>
 *    (barcode typos on the website, e.g. 5030969210723 vs Mercury's
 *    5060969210723, can't be matched safely by machine).
 */
export function matchProducts(website, mercury, forced = new Map()) {
  const byId = new Map(mercury.map((m) => [m.id, m]));
  const byBarcode = new Map();
  for (const m of mercury) {
    if (!byBarcode.has(m.barcode)) byBarcode.set(m.barcode, []);
    byBarcode.get(m.barcode).push(m);
  }
  const links = new Map();
  const taken = new Set();
  // Person-confirmed links first, so they win over a stale mercury_id on some
  // other row (e.g. a hidden copy an earlier run added before the link was confirmed).
  for (const w of website) {
    const confirmed = forced.get(w.sku);
    if (confirmed && byId.has(confirmed) && !taken.has(confirmed)) {
      links.set(w.id, { m: byId.get(confirmed), score: 1, via: "confirmed" });
      taken.add(confirmed);
    }
  }
  for (const w of website) {
    if (links.has(w.id)) continue;
    if (w.mercury_id && byId.has(w.mercury_id) && !taken.has(w.mercury_id)) {
      links.set(w.id, { m: byId.get(w.mercury_id), score: 1, via: "mercury_id" });
      taken.add(w.mercury_id);
    }
  }
  const pairs = [];
  for (const w of website) {
    if (links.has(w.id)) continue;
    const family = w.sku.replace(/-\d+$/, "");
    for (const m of byBarcode.get(family) ?? []) {
      if (taken.has(m.id)) continue;
      pairs.push({ w, m, score: similarity(w.name, m.name), exact: w.sku === m.barcode, alone: byBarcode.get(family).length === 1 });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  for (const p of pairs) {
    if (links.has(p.w.id) || taken.has(p.m.id)) continue;
    // A lone exact barcode only needs the names to be loosely alike; a shared
    // barcode needs a clearer name match to pick the right one.
    if (p.score < (p.exact && p.alone ? 0.15 : 0.25)) continue;
    links.set(p.w.id, { m: p.m, score: p.score, via: p.exact ? "barcode" : "barcode family" });
    taken.add(p.m.id);
  }
  const suggestions = [];
  for (const w of website) {
    if (links.has(w.id)) continue;
    let best = null;
    for (const m of mercury) {
      if (taken.has(m.id)) continue;
      const score = similarity(w.name, m.name);
      if (!best || score > best.score) best = { m, score };
    }
    // Report-only hint for a human, so a loose bar is fine.
    suggestions.push({ w, best: best && best.score >= 0.3 ? best : null });
  }
  return { links, taken, suggestions };
}

async function readAll(db, table, cols, filter = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(cols)).range(from, from + 999);
    if (error) throw new Error(`reading ${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const mirror = (db, entity, since = null) =>
  readAll(db, "mercury_records", "mercury_key, data", (q) => {
    const base = q.eq("entity", entity);
    return (since ? base.gte("record_date", since) : base).order("mercury_key");
  });

/**
 * Which price list explains a store's invoices best. `lines` are
 * { product, charged } where product carries Mercury's base and per-list
 * prices; a list with no price for a product falls back to base, as in
 * Mercury. Returns { listId ("0" = base), share, lines } or null.
 *
 * Many lists share prices, so ties are common; they go to the store's
 * contract list, then its current website list, then base.
 */
export function bestList(lines, listIds, prefer = []) {
  if (lines.length < 3) return null;
  const priceFor = (p, id) => (id === "0" ? p.base : num(p.prices[id]) || p.base);
  let best = null;
  const order = [...new Set([...prefer.filter(Boolean), "0", ...listIds])];
  for (const id of order) {
    const hits = lines.filter((l) => priceFor(l.product, id) === l.charged).length;
    if (!best || hits > best.hits) best = { listId: id, hits };
  }
  return { listId: best.listId, share: best.hits / lines.length, lines: lines.length };
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

async function buildPlan(db, flags) {
  const [mProducts, mDetails, mTypes, mCustomers, mCustomerDetails, mStock] = await Promise.all(
    ["product", "product_detail", "price_type", "customer", "customer_detail", "stock_balance"].map((e) => mirror(db, e)),
  );
  if (!mProducts.length || !mTypes.length || !mCustomers.length) {
    fail("The Mercury mirror is empty — run scripts/mercury-sync.mjs first.");
  }
  // Recent invoices: the evidence for what each store really pays.
  const [evidenceOrders, evidenceLines] = await Promise.all([
    mirror(db, "order", flags.evidenceSince),
    mirror(db, "bigdata_line", flags.evidenceSince),
  ]);
  const [wProducts, wLists, wItems, wStores, wOverrides, wCategories] = await Promise.all([
    readAll(db, "products", "*"),
    readAll(db, "price_lists", "*"),
    readAll(db, "price_list_items", "price_list_id, product_id, price"),
    readAll(db, "supermarkets", "*"),
    readAll(db, "customer_prices", "supermarket_id, product_id, price, updated_at"),
    readAll(db, "categories", "*"),
  ]);
  const schemaReady = "mercury_id" in (wProducts[0] ?? {}) && "registry_number" in (wStores[0] ?? {});
  // Mercury category id → website category (fix 38). Empty before fix 38.
  const categoryByMercury = new Map();
  for (const c of wCategories) for (const mid of c.mercury_ids ?? []) categoryByMercury.set(String(mid), c.id);

  const detailById = new Map(mDetails.map((r) => [r.mercury_key, r.data]));
  const stockById = new Map(mStock.map((r) => [r.mercury_key, r.data]));
  const mercury = mProducts.map((r) => {
    const d = detailById.get(r.mercury_key);
    return {
      id: r.mercury_key,
      barcode: r.data["Бар.код"] ?? "",
      name: r.data["Барааны нэр"] ?? "",
      code: r.data["Дотоод код"] || null,
      base: num(r.data.prices?.["Үндсэн үнэ"]),
      box: int(r.data["Хайрцагт"]),
      hidden: /^hide/i.test(r.data["Show Эрэмбэ"] ?? ""),
      categoryId: categoryByMercury.get(String(r.data._ids?.category ?? "")) ?? null,
      prices: r.data.prices_by_list_id ?? {},
      detail: d ?? null,
      stock: stockById.has(r.mercury_key) ? int(stockById.get(r.mercury_key)["Үлдэгдэл Тоо"]) : null,
    };
  });

  // ---- products ----
  const { links, taken, suggestions } = matchProducts(wProducts, mercury, flags.links);
  const productUpdates = [];
  const productLinks = [];
  for (const w of wProducts) {
    const link = links.get(w.id);
    if (!link) continue;
    const m = link.m;
    productLinks.push({ website_id: w.id, sku: w.sku, website_name: w.name, mercury_id: m.id, mercury_name: m.name, score: Number(link.score.toFixed(2)), via: link.via });
    const next = { mercury_id: m.id, internal_code: m.code, base_price: m.base };
    if (m.box != null && m.box > 0) next.box_count = m.box;
    if (m.detail) {
      next.vat_payable = m.detail.noat === true;
      next.city_tax = m.detail.nhat === true;
      next.ebarimt_class_code = m.detail.classificationCode || null;
      next.ebarimt_tax_code = m.detail.taxProductCode || null;
      if (blank(w.unit) && m.detail.unit_id?.text) next.unit = m.detail.unit_id.text;
    }
    if (flags.syncStock && m.stock != null) next.stock = Math.max(0, m.stock);
    // Category: fill a blank only — admins curate it on /admin/categories.
    if (!w.category_id && m.categoryId) next.category_id = m.categoryId;
    // Don't zero a real base price because Mercury left it blank.
    if (m.base === 0 && Number(w.base_price) > 0) delete next.base_price;
    const changes = {};
    for (const [k, v] of Object.entries(next)) {
      const old = w[k];
      const same = typeof v === "number" ? Number(old) === v : (old ?? null) === (v ?? null);
      if (!same) changes[k] = [old ?? null, v];
    }
    if (Object.keys(changes).length) productUpdates.push({ id: w.id, sku: w.sku, name: w.name, changes });
  }
  const usedSkus = new Set(wProducts.map((p) => p.sku));
  // A Mercury product that looks like an existing website product (it's the
  // name-only suggestion for one) is never auto-published: until someone
  // confirms the link with --link, publishing it would show buyers a duplicate.
  const lookalikes = new Set(suggestions.filter((s) => s.best).map((s) => s.best.m.id));
  const productInserts = [];
  for (const m of mercury) {
    if (taken.has(m.id)) continue;
    let sku = m.barcode || `M-${m.id}`;
    if (usedSkus.has(sku)) sku = `${sku}-m${m.id}`;
    usedSkus.add(sku);
    productInserts.push({
      tempId: `new:${m.id}`,
      row: {
        sku,
        name: m.name,
        base_price: m.base,
        box_count: m.box && m.box > 0 ? m.box : null,
        unit: m.detail?.unit_id?.text ?? null,
        stock: Math.max(0, m.stock ?? 0),
        active: flags.activateNew && !m.hidden && m.base > 0 && !lookalikes.has(m.id),
        mercury_id: m.id,
        internal_code: m.code,
        category_id: m.categoryId,
        vat_payable: m.detail ? m.detail.noat === true : null,
        city_tax: m.detail ? m.detail.nhat === true : null,
        ebarimt_class_code: m.detail?.classificationCode || null,
        ebarimt_tax_code: m.detail?.taxProductCode || null,
      },
      mercuryHidden: m.hidden,
    });
  }
  // Website product id (or temp id) for every Mercury product.
  const productIdByMercury = new Map();
  for (const [wid, link] of links) productIdByMercury.set(link.m.id, wid);
  for (const ins of productInserts) productIdByMercury.set(ins.row.mercury_id, ins.tempId);

  const stockCompare = [...links].map(([wid, link]) => {
    const w = wProducts.find((p) => p.id === wid);
    return { sku: w.sku, name: w.name, website: w.stock, mercury: link.m.stock };
  });

  // ---- price lists ----
  const itemsByList = new Map();
  for (const it of wItems) {
    if (!itemsByList.has(it.price_list_id)) itemsByList.set(it.price_list_id, new Map());
    itemsByList.get(it.price_list_id).set(it.product_id, Number(it.price));
  }
  const listLinks = [];
  const listCreates = [];
  const listIdByMercury = new Map();
  const claimed = new Set();
  const typeName = (t) => t.data["Үнийн ангилалийн нэр"] ?? "";
  for (const t of mTypes) {
    const byId = wLists.find((l) => l.mercury_id === t.mercury_key);
    const byName = byId ?? wLists.find((l) => !claimed.has(l.id) && norm(l.name) === norm(typeName(t)));
    if (byName) {
      claimed.add(byName.id);
      listIdByMercury.set(t.mercury_key, byName.id);
      listLinks.push({ mercury_id: t.mercury_key, mercury_name: typeName(t), website_id: byName.id, website_name: byName.name, via: byId ? "mercury_id" : "name" });
    }
  }
  for (const t of mTypes) {
    if (listIdByMercury.has(t.mercury_key)) continue;
    // A renamed list: the website list whose prices agree with Mercury's.
    let best = null;
    for (const l of wLists) {
      if (claimed.has(l.id)) continue;
      const items = itemsByList.get(l.id) ?? new Map();
      let compared = 0;
      let equal = 0;
      for (const m of mercury) {
        const pid = productIdByMercury.get(m.id);
        const mp = num(m.prices[t.mercury_key]);
        if (!items.has(pid) || mp <= 0) continue;
        compared++;
        if (items.get(pid) === mp) equal++;
      }
      const ratio = compared ? equal / compared : 0;
      if (compared >= 3 && ratio >= 0.8 && (!best || ratio > best.ratio)) best = { l, ratio, compared };
    }
    if (best) {
      claimed.add(best.l.id);
      listIdByMercury.set(t.mercury_key, best.l.id);
      listLinks.push({ mercury_id: t.mercury_key, mercury_name: typeName(t), website_id: best.l.id, website_name: best.l.name, via: `prices agree ${best.compared === 0 ? "" : `${Math.round(best.ratio * 100)}% of ${best.compared}`}` });
    } else {
      const tempId = `new-list:${t.mercury_key}`;
      listIdByMercury.set(t.mercury_key, tempId);
      listCreates.push({ tempId, row: { name: typeName(t), mercury_id: t.mercury_key, description: `Mercury: ${t.data["Код"] ?? ""}`.trim() } });
    }
  }
  const websiteOnlyLists = wLists.filter((l) => !claimed.has(l.id)).map((l) => l.name);

  // ---- list prices ----
  const itemUpserts = [];
  const itemDeletes = [];
  for (const t of mTypes) {
    const lid = listIdByMercury.get(t.mercury_key);
    const existing = itemsByList.get(lid) ?? new Map();
    for (const m of mercury) {
      const pid = productIdByMercury.get(m.id);
      if (!pid) continue;
      const price = num(m.prices[t.mercury_key]);
      const old = existing.get(pid);
      if (price > 0 && old !== price) itemUpserts.push({ price_list_id: lid, product_id: pid, price, old: old ?? null });
      if (price <= 0 && old != null) itemDeletes.push({ price_list_id: lid, product_id: pid, old });
    }
  }

  // ---- stores ----
  const detailByCustomer = new Map(mCustomerDetails.map((r) => [r.mercury_key, r.data]));
  const mercuryListIdByName = new Map(mTypes.map((t) => [norm(typeName(t)), t.mercury_key]));
  const storesByExternal = new Map(wStores.filter((s) => s.external_id).map((s) => [s.external_id, s]));
  const listName = (id) => (id == null ? "(үндсэн үнэ)" : wLists.find((l) => l.id === id)?.name ?? listCreates.find((c) => c.tempId === id)?.row.name ?? id);
  const mercuryIdOfWebsiteList = new Map(listLinks.map((l) => [l.website_id, l.mercury_id]));
  for (const c of listCreates) mercuryIdOfWebsiteList.set(c.tempId, c.row.mercury_id);
  const typeIds = mTypes.map((t) => t.mercury_key);
  const websiteListFor = (mid) => (mid === "0" ? null : listIdByMercury.get(mid));

  // What each store was actually invoiced: BigData line → document → order → store.
  const customerByDoc = new Map();
  for (const o of evidenceOrders) {
    if (o.data._ids?.ViewOrder && o.data._ids?.View2ShopNoHead) customerByDoc.set(o.data._ids.ViewOrder, o.data._ids.View2ShopNoHead);
  }
  const productByCode = new Map(mercury.filter((m) => m.code).map((m) => [m.code, m]));
  const invoiced = new Map();
  for (const l of evidenceLines) {
    const customer = customerByDoc.get(l.mercury_key.split(":")[0]);
    const product = productByCode.get(l.data["Барааны Код"]);
    const charged = num(l.data["Үнэ"]);
    if (!customer || !product || !charged) continue;
    if (!invoiced.has(customer)) invoiced.set(customer, []);
    invoiced.get(customer).push({ product, charged });
  }

  const storeUpserts = [];
  const storeInserts = [];
  const listChanges = {};
  const keptWebsiteList = {};
  const websiteOnlyIds = new Set(wLists.filter((l) => !claimed.has(l.id)).map((l) => l.id));
  const noDetail = [];
  const unknownLists = {};
  const discounts = [];
  const textDiffs = [];
  const priceSource = { invoices: 0, kept_no_evidence: 0, contract_new_store: 0, website_only_list: 0 };
  const plannedListOf = new Map();
  for (const c of mCustomers) {
    const d = c.data;
    const det = detailByCustomer.get(c.mercury_key);
    if (!det) noDetail.push(c.mercury_key);
    // Mercury's contract field as a Mercury list id ("0" = base): only a tie-breaker and a fallback.
    let contractId;
    if (det) {
      const name = det._parsed?.price_list ?? "";
      if (blank(name) || norm(name) === norm("Үндсэн үнэ")) contractId = "0";
      else if (mercuryListIdByName.has(norm(name))) contractId = mercuryListIdByName.get(norm(name));
      else unknownLists[name] = (unknownLists[name] ?? 0) + 1;
    }
    const discount = det ? num(det._parsed?.discount_pct) : null;
    if (discount) discounts.push({ external_id: c.mercury_key, name: d["Цэгийн нэр"] || d["Компани"], discount_pct: discount });
    const s = storesByExternal.get(c.mercury_key);

    let targetList; // undefined = leave the store's list as it is
    if (s && websiteOnlyIds.has(s.price_list_id)) {
      // Put on a website-only list (e.g. "Бөмбөгөр 11") on purpose by someone
      // on the website; Mercury knows nothing about it.
      priceSource.website_only_list++;
      const name = listName(s.price_list_id);
      keptWebsiteList[name] = (keptWebsiteList[name] ?? 0) + 1;
    } else {
      const current = s ? (s.price_list_id == null ? "0" : mercuryIdOfWebsiteList.get(s.price_list_id)) : undefined;
      const evidence = bestList(invoiced.get(c.mercury_key) ?? [], typeIds, [contractId, current]);
      if (evidence && evidence.share >= 0.6) {
        targetList = websiteListFor(evidence.listId);
        priceSource.invoices++;
      } else if (s) {
        priceSource.kept_no_evidence++;
      } else if (contractId !== undefined) {
        targetList = websiteListFor(contractId);
        priceSource.contract_new_store++;
      }
    }
    plannedListOf.set(c.mercury_key, targetList !== undefined ? targetList : (s?.price_list_id ?? null));

    const mercuryFields = {
      registry_number: blank(d["РД"]) ? (det?._parsed?.rd ?? null) : d["РД"],
      receivable: num(d["Авлага"]),
      lat: num(d["Lat"]) || null,
      lng: num(d["Long"]) || null,
      ...(det ? { discount_pct: discount } : {}),
      ...(targetList !== undefined ? { price_list_id: targetList } : {}),
    };
    if (s) {
      const row = { external_id: s.external_id, name: s.name, ...mercuryFields };
      // Fill blanks only; differences are reported, never overwritten.
      for (const [col, src] of [["type", "Төрөл"], ["district", "Дүүрэг"], ["address", "Хаяг"], ["contact_phone", "Утас"]]) {
        if (blank(s[col]) && !blank(d[src])) row[col] = d[src];
        else if (!blank(d[src]) && norm(s[col]) !== norm(d[src])) textDiffs.push({ external_id: s.external_id, field: col, website: s[col], mercury: d[src] });
      }
      const changed = Object.entries(row).some(([k, v]) => k !== "external_id" && k !== "name" && (typeof v === "number" ? Number(s[k]) !== v : (s[k] ?? null) !== (v ?? null)));
      if (targetList !== undefined && (s.price_list_id ?? null) !== (targetList ?? null)) {
        const key = `${listName(s.price_list_id)} → ${listName(targetList)}`;
        listChanges[key] = (listChanges[key] ?? 0) + 1;
      }
      if (changed) storeUpserts.push(row);
    } else if (d["Төлөв"] === "Хэвийн") {
      const branch = d["Цэгийн нэр"];
      const company = d["Компани"];
      const notes = [branch && company ? `Компани: ${company}` : null, d["дотоод код"] ? `Дотоод код: ${d["дотоод код"]}` : null, d["Менежер"] ? `Менежер: ${d["Менежер"]}` : null]
        .filter(Boolean)
        .join("\n");
      if (!(branch || company)) continue;
      storeInserts.push({
        external_id: c.mercury_key,
        name: branch || company,
        type: d["Төрөл"] || null,
        district: d["Дүүрэг"] || null,
        address: d["Хаяг"] || null,
        contact_phone: d["Утас"] || null,
        notes: notes || null,
        active: true,
        ...mercuryFields,
      });
    }
  }

  // ---- per-store overrides from the old bulk import ----
  const purge = wOverrides.filter((o) => o.updated_at.slice(0, 10) === flags.overrideDay);
  const keep = wOverrides.filter((o) => o.updated_at.slice(0, 10) !== flags.overrideDay);

  // ---- would the website charge what Mercury invoiced? ----
  // The same resolution the supermarket_prices view uses — store override,
  // then the store's list, then base — computed for today and for after the
  // plan, against every recent invoice line of a store and product the
  // website already has.
  const key2 = (a, b) => `${a}|${b}`;
  const websiteIdByMercury = new Map([...links].map(([wid, l]) => [l.m.id, wid]));
  const currentBase = new Map(wProducts.map((w) => [w.id, Number(w.base_price)]));
  const plannedBase = new Map(currentBase);
  for (const u of productUpdates) if (u.changes.base_price) plannedBase.set(u.id, u.changes.base_price[1]);
  const overridesNow = new Map(wOverrides.map((o) => [key2(o.supermarket_id, o.product_id), Number(o.price)]));
  const overridesAfter = new Map((flags.purgeOverrides ? keep : wOverrides).map((o) => [key2(o.supermarket_id, o.product_id), Number(o.price)]));
  const itemNow = (listId, wid) => itemsByList.get(listId)?.get(wid);
  const simulation = { invoice_lines: 0, product_not_on_website: 0, match_today: 0, match_after: 0 };
  for (const [customer, lines] of invoiced) {
    const s = storesByExternal.get(customer);
    if (!s) continue;
    const plannedList = plannedListOf.get(customer);
    const plannedMid = plannedList == null ? "0" : mercuryIdOfWebsiteList.get(plannedList);
    for (const { product, charged } of lines) {
      const wid = websiteIdByMercury.get(product.id);
      if (!wid) {
        simulation.product_not_on_website++;
        continue;
      }
      simulation.invoice_lines++;
      const today = overridesNow.get(key2(s.id, wid)) ?? itemNow(s.price_list_id, wid) ?? currentBase.get(wid);
      if (today === charged) simulation.match_today++;
      let after = overridesAfter.get(key2(s.id, wid));
      if (after == null) {
        if (plannedMid === "0") after = plannedBase.get(wid);
        else if (plannedMid) after = num(product.prices[plannedMid]) || plannedBase.get(wid);
        else after = itemNow(plannedList, wid) ?? plannedBase.get(wid); // website-only list
      }
      if (after === charged) simulation.match_after++;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    flags,
    schemaReady,
    products: {
      linked: productLinks,
      low_confidence: productLinks.filter((l) => l.via !== "mercury_id" && l.score < 0.4),
      update: productUpdates,
      insert: productInserts,
      unmatched_website: suggestions.map(({ w, best }) => ({
        sku: w.sku,
        name: w.name,
        suggestion: best ? { mercury_id: best.m.id, name: best.m.name, barcode: best.m.barcode, score: Number(best.score.toFixed(2)) } : null,
      })),
      stock_compare: stockCompare,
    },
    price_lists: { linked: listLinks, create: listCreates, website_only: websiteOnlyLists },
    list_prices: { upsert: itemUpserts, delete: itemDeletes },
    stores: {
      update: storeUpserts,
      insert: storeInserts,
      list_changes: listChanges,
      price_list_source: priceSource,
      kept_website_lists: keptWebsiteList,
      no_detail: noDetail,
      unknown_lists: unknownLists,
      discounts,
      text_differences: textDiffs,
    },
    overrides: { purge_count: purge.length, keep },
    invoice_check: { since: flags.evidenceSince, ...simulation },
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function report(plan) {
  const p = plan.products;
  const big = p.update.filter((u) => u.changes.base_price && Math.abs(u.changes.base_price[1] - u.changes.base_price[0]) / (u.changes.base_price[0] || 1) > 0.3);
  const line = (s = "") => console.log(s);
  const visibleNew = p.insert.filter((i) => i.row.active).length;
  line(`PRODUCTS   ${p.linked.length} linked to Mercury, ${p.update.length} to update, ${p.insert.length} new from Mercury (${visibleNew} visible, ${p.insert.length - visibleNew} hidden)`);
  line(`           base price changes: ${p.update.filter((u) => u.changes.base_price).length}${big.length ? `, ${big.length} by more than 30%` : ""}`);
  for (const u of big) line(`             ${u.sku}  ${u.name.slice(0, 40)}: ${u.changes.base_price[0]} → ${u.changes.base_price[1]}`);
  if (p.low_confidence.length) {
    line(`           links to double-check (names differ):`);
    for (const l of p.low_confidence) line(`             ${l.sku} "${l.website_name.slice(0, 34)}" ↔ "${l.mercury_name.slice(0, 34)}" (${l.score})`);
  }
  if (p.unmatched_website.length) {
    line(`           website products with no Mercury match (left as they are):`);
    for (const u of p.unmatched_website) line(`             ${u.sku} "${u.name.slice(0, 40)}"${u.suggestion ? `  → maybe "${u.suggestion.name.slice(0, 34)}" (${u.suggestion.barcode}, ${u.suggestion.score})` : ""}`);
  }
  const stockKnown = p.stock_compare.filter((s) => s.mercury != null);
  line(`           stock: ${plan.flags.syncStock ? "WILL sync" : "not touched (use --sync-stock)"}; Mercury shows ≤0 for ${stockKnown.filter((s) => s.mercury <= 0).length} of ${stockKnown.length} linked products that the website has ${stockKnown.filter((s) => s.mercury <= 0 && s.website > 0).length} in stock`);
  line();
  const l = plan.price_lists;
  line(`PRICE LISTS ${l.linked.length} linked, ${l.create.length} to create${l.create.length ? ` (${l.create.map((c) => c.row.name).join(", ")})` : ""}`);
  for (const x of l.linked.filter((x) => x.via !== "name" && x.via !== "mercury_id")) line(`           "${x.mercury_name}" ↔ "${x.website_name}" (${x.via})`);
  if (l.website_only.length) line(`           website-only, untouched: ${l.website_only.join(", ")}`);
  line(`LIST PRICES ${plan.list_prices.upsert.length} set/changed, ${plan.list_prices.delete.length} removed (Mercury has no special price → base price)`);
  line();
  const s = plan.stores;
  line(`STORES     ${s.update.length} updated, ${s.insert.length} new active Mercury customers added`);
  const changes = Object.entries(s.list_changes).sort((a, b) => b[1] - a[1]);
  const src = s.price_list_source;
  line(`           price list decided by: invoices ${src.invoices}, kept (too few invoices) ${src.kept_no_evidence}, website-only list kept ${src.website_only_list}, contract (new stores) ${src.contract_new_store}`);
  line(`           price-list changes: ${changes.reduce((n, [, v]) => n + v, 0)} stores`);
  for (const [k, v] of changes.slice(0, 15)) line(`             ${String(v).padStart(4)}  ${k}`);
  if (changes.length > 15) line(`             … ${changes.length - 15} more kinds (see the plan file)`);
  for (const [k, v] of Object.entries(s.kept_website_lists)) line(`           kept on website-only list "${k}": ${v} stores`);
  if (s.no_detail.length) line(`           ${s.no_detail.length} customers had no detail page copied — their price list is left unchanged`);
  if (Object.keys(s.unknown_lists).length) line(`           unknown Mercury list names (left unchanged): ${JSON.stringify(s.unknown_lists)}`);
  line(`           Mercury per-store discounts: ${s.discounts.length} stores (recorded in discount_pct, not applied to prices yet)`);
  line(`           name/address/phone differences kept as on the website: ${s.text_differences.length}`);
  line();
  line(`OVERRIDES  ${plan.overrides.purge_count} per-store prices from the ${plan.flags.overrideDay} bulk import ${plan.flags.purgeOverrides ? "WILL be removed (backed up first)" : "kept (use --purge-store-overrides)"}; ${plan.overrides.keep.length} hand-edited kept`);
  line();
  const ic = plan.invoice_check;
  const pct = (n) => (ic.invoice_lines ? `${((100 * n) / ic.invoice_lines).toFixed(1)}%` : "—");
  line(`INVOICE CHECK  ${ic.invoice_lines} Mercury invoice lines since ${ic.since} for stores + products the website has:`);
  line(`           website charges exactly the invoiced price — today: ${pct(ic.match_today)}, after this import: ${pct(ic.match_after)}`);
  line(`           (${ic.product_not_on_website} more lines are for products not on the website yet)`);
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

async function apply(db, plan, stamp) {
  if (!plan.schemaReady) fail("Run docs/fixes/36-mercury-link.sql in the Supabase SQL editor first (adds mercury_id and the e-Barimt/store columns).");

  // 1. Backup of everything this run can touch.
  const backup = {
    taken_at: new Date().toISOString(),
    products: await readAll(db, "products", "*"),
    price_lists: await readAll(db, "price_lists", "*"),
    price_list_items: await readAll(db, "price_list_items", "*"),
    supermarkets: await readAll(db, "supermarkets", "*"),
    customer_prices: await readAll(db, "customer_prices", "*"),
  };
  const backupPath = path.join(OUT_DIR, `import-backup-${stamp}.json`);
  await writeFile(backupPath, JSON.stringify(backup));
  console.log(`✓ backup written: ${backupPath}`);

  const idMap = new Map(); // temp id → real id
  const real = (id) => idMap.get(id) ?? id;
  const check = (error, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  // 2. Price lists: link existing, create missing.
  for (const l of plan.price_lists.linked) {
    if (l.via === "mercury_id") continue;
    const { error } = await db.from("price_lists").update({ mercury_id: l.mercury_id }).eq("id", l.website_id);
    check(error, `linking list ${l.website_name}`);
  }
  for (const c of plan.price_lists.create) {
    const { data, error } = await db.from("price_lists").insert(c.row).select("id").single();
    check(error, `creating list ${c.row.name}`);
    idMap.set(c.tempId, data.id);
  }
  console.log(`✓ price lists: ${plan.price_lists.linked.length} linked, ${plan.price_lists.create.length} created`);

  // 3. Products: update linked, insert new.
  for (const u of plan.products.update) {
    const values = Object.fromEntries(Object.entries(u.changes).map(([k, [, v]]) => [k, v]));
    const { error } = await db.from("products").update(values).eq("id", u.id);
    check(error, `updating product ${u.sku}`);
  }
  for (let i = 0; i < plan.products.insert.length; i += 200) {
    const batch = plan.products.insert.slice(i, i + 200);
    const { data, error } = await db.from("products").insert(batch.map((b) => b.row)).select("id, mercury_id");
    check(error, "inserting products");
    for (const r of data) idMap.set(`new:${r.mercury_id}`, r.id);
  }
  console.log(`✓ products: ${plan.products.update.length} updated, ${plan.products.insert.length} added`);

  // 4. List prices.
  const upserts = plan.list_prices.upsert.map((x) => ({ price_list_id: real(x.price_list_id), product_id: real(x.product_id), price: x.price }));
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await db.from("price_list_items").upsert(upserts.slice(i, i + 500), { onConflict: "price_list_id,product_id" });
    check(error, "setting list prices");
  }
  const delByList = new Map();
  for (const x of plan.list_prices.delete) {
    if (!delByList.has(x.price_list_id)) delByList.set(x.price_list_id, []);
    delByList.get(x.price_list_id).push(x.product_id);
  }
  for (const [lid, pids] of delByList) {
    const { error } = await db.from("price_list_items").delete().eq("price_list_id", lid).in("product_id", pids);
    check(error, "removing list prices");
  }
  console.log(`✓ list prices: ${upserts.length} set, ${plan.list_prices.delete.length} removed`);

  // 5. Stores — one write per distinct column set. In a bulk upsert, a column
  // that only some rows carry is written as NULL for the others (the request
  // takes the union of all rows' keys). That blanked 1,144 stores' districts,
  // phones and price lists on 2026-11-04 until they were restored from the
  // backup; grouping by key set makes every row carry exactly its own columns.
  const fix = (r) => ("price_list_id" in r ? { ...r, price_list_id: r.price_list_id == null ? null : real(r.price_list_id) } : r);
  const byColumns = (rows) => {
    const groups = new Map();
    for (const r of rows) {
      const sig = Object.keys(r).sort().join(",");
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(r);
    }
    return [...groups.values()];
  };
  for (const rows of byColumns(plan.stores.update.map(fix))) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("supermarkets").upsert(rows.slice(i, i + 500), { onConflict: "external_id" });
      check(error, "updating stores");
    }
  }
  for (const rows of byColumns(plan.stores.insert.map(fix))) {
    const { error } = await db.from("supermarkets").insert(rows);
    check(error, "adding stores");
  }
  console.log(`✓ stores: ${plan.stores.update.length} updated, ${plan.stores.insert.length} added`);

  // 6. The old bulk per-store prices (backed up in step 1).
  if (plan.flags.purgeOverrides && plan.overrides.purge_count) {
    const day = plan.flags.overrideDay;
    const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const { error } = await db.from("customer_prices").delete().gte("updated_at", `${day}T00:00:00Z`).lt("updated_at", `${next}T00:00:00Z`);
    check(error, "removing bulk per-store prices");
    console.log(`✓ per-store prices from ${day}: ${plan.overrides.purge_count} removed`);
  }

  // 7. Safety net: no value the plan didn't mean to blank may have become empty.
  const intendedNull = {
    supermarkets: new Set(plan.stores.update.filter((r) => "price_list_id" in r && r.price_list_id == null).map((r) => `${r.external_id}.price_list_id`)),
    products: new Set(plan.products.update.flatMap((u) => Object.entries(u.changes).filter(([, [, v]]) => v == null).map(([k]) => `${u.id}.${k}`))),
  };
  const blanked = [];
  for (const [table, rowKey] of [["supermarkets", (s) => s.external_id], ["products", (p) => p.id]]) {
    const before = new Map(backup[table].map((r) => [r.id, r]));
    for (const r of await readAll(db, table, "*")) {
      const b = before.get(r.id);
      if (!b) continue;
      for (const [col, val] of Object.entries(b)) {
        if (val != null && r[col] == null && !intendedNull[table].has(`${rowKey(r)}.${col}`)) blanked.push(`${table} ${rowKey(r)}.${col}`);
      }
    }
  }
  if (blanked.length) {
    fail(`${blanked.length} values were blanked unexpectedly (e.g. ${blanked.slice(0, 5).join(", ")}). Restore them from ${backupPath}.`);
  }
  console.log("✓ integrity check: no value was blanked unexpectedly");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const flags = {
    apply: argv.includes("--apply"),
    purgeOverrides: argv.includes("--purge-store-overrides"),
    activateNew: argv.includes("--activate-new"),
    syncStock: argv.includes("--sync-stock"),
    overrideDay: "2026-05-12",
    links: new Map(),
    evidenceSince: null,
  };
  const monthsArg = argv.indexOf("--evidence-months");
  const months = monthsArg >= 0 ? Number(argv[monthsArg + 1]) : 6;
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  flags.evidenceSince = since.toISOString().slice(0, 10);
  const dayArg = argv.indexOf("--override-day");
  if (dayArg >= 0) flags.overrideDay = argv[dayArg + 1];
  // --link <website sku>=<mercury product id>, repeatable: links a person confirmed.
  argv.forEach((a, i) => {
    if (a !== "--link") return;
    const m = (argv[i + 1] ?? "").match(/^(.+)=(\d+)$/);
    if (!m) fail(`--link needs <website sku>=<mercury id>, got "${argv[i + 1] ?? ""}"`);
    flags.links.set(m[1], m[2]);
  });
  for (const a of argv) {
    if (a.startsWith("--") && !["--apply", "--purge-store-overrides", "--activate-new", "--sync-stock", "--override-day", "--link", "--evidence-months"].includes(a)) fail(`Unknown option ${a}`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Supabase env missing — run with --env-file=.env.local.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  await mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const plan = await buildPlan(db, flags);
  const planPath = path.join(OUT_DIR, `import-plan-${stamp}.json`);
  await writeFile(planPath, JSON.stringify(plan, null, 2));
  console.log(`${flags.apply ? "APPLYING" : "DRY RUN — nothing written"}   plan: ${planPath}\n`);
  report(plan);
  if (!plan.schemaReady) console.log("\n⚠ docs/fixes/36-mercury-link.sql has not been run yet — needed before --apply.");
  if (flags.apply) {
    console.log("");
    await apply(db, plan, stamp);
    console.log("\n✓ done");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => fail(e?.stack || String(e)));
}
