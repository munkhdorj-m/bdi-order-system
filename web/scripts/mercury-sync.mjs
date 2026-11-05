#!/usr/bin/env node
/**
 * Mercury → BDI mirror sync
 * =========================
 * Copies everything BDI has in Mercury (BTGT's app.gps.mn) into
 * public.mercury_records (docs/fixes/35-mercury-mirror.sql), plus Mercury's
 * raw pages under scripts/.mercury-data/, so nothing is lost while BDI tests
 * its own website and before Mercury is switched off. Re-runnable: rows are
 * upserted by Mercury's own ids, so each run refreshes the copy.
 *
 * STRICTLY READ-ONLY toward Mercury. Mercury exposes destructive actions as
 * plain links — a GET to cron/jobs/product_balance_cron/66 closes the month,
 * cron/jobs/order_close/66 closes every waybill older than 3 days — so every
 * request goes through assertSafe(): an explicit allowlist of read pages, and
 * a blocklist that refuses anything resembling a write even if allowlisted.
 * Redirects are never followed for the same reason.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/mercury-sync.mjs                 everything, 2023-01-01 → today
 *   node --env-file=.env.local scripts/mercury-sync.mjs --only product,customer
 *   node --env-file=.env.local scripts/mercury-sync.mjs --from 2026-10-01
 *   node --env-file=.env.local scripts/mercury-sync.mjs --no-db         raw files + NDJSON only
 *
 * Env (web/.env.local):
 *   MERCURY_USERNAME, MERCURY_PASSWORD      BDI's own Mercury login
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createHash } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "node-html-parser";
import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.MERCURY_BASE_URL || "https://app.gps.mn/index.php/").replace(/\/?$/, "/");
const UA = "BDI-Mercury-Export/1.0 (read-only export of BDI's own data)";

// ---------------------------------------------------------------------------
// Safety: the only requests this script may ever make
// ---------------------------------------------------------------------------

/** Pages the sync may GET. Anything else is refused. */
const READ_GET = new Set([
  // Sales module
  "shop/index/ProductList",
  "shop/index/PriceTypeList",
  "shop/index/CategoryList",
  "shop/index/FactoryList",
  "shop/index/AguulahList",
  "shop/index/KeyWordsList",
  "shop/index/PlanningList",
  "shop/index/Uramshuulal",
  "shop/index/ProductSet",
  "shop/index/OrdersList",
  "shop/index/PaymentList",
  "shop/index/Ebarimt",
  // Customer / GPS module
  "home/index/shop2XLS",
  "home/index/shop2types",
  "home/index/OrderListShop2",
  "home/index/LoanList",
  "home/index/PlanningList",
  "home/index/Shop2Comments",
  "home/index/users",
  "home/index/CarList",
  "home/index/Points",
  "home/index/Paths",
  "home/index/Talbai",
  // Stock report, and date-searchable logs
  "shop/index/reportAguulahNew",
  "home/index/deletedOrders",
  "home/index/Dans_huulga",
  "home/index/CardHistory",
]);

/** Search forms and exports that take a POST but only read — plus login. */
const READ_POST = new Set([
  "ajax/index/login",
  "shop/index/BigData",
  "shop/index/OrdersList",
  "shop/index/PaymentList",
  "shop/index/Ebarimt",
  "home/index/OrderListShop2",
  "home/index/Shop2Comments",
  "home/index/deletedOrders",
  "home/index/Dans_huulga",
  "home/index/CardHistory",
]);

/**
 * Per-record detail pages, read by numeric id. GET only, anchored so nothing
 * can be appended. ProductEdit is Mercury's product form: we only ever load
 * it to read the current values (VAT flags, e-Barimt codes) — never submit it.
 */
const READ_GET_PATTERNS = [
  /^home\/index\/View2Shop\/\d+$/,
  /^home\/index\/View2ShopTootsoo\/\d+$/,
  /^shop\/index\/ProductEdit\/\d+$/,
  /^home\/index\/noheadViewOrderShop2Mini\/\d+\/-?\d+$/,
];

/** Allowlisted pages whose names merely contain a write-like word ("deleted orders" is a read-only list). */
const WRITE_WORD_OK = new Set(["home/index/deletedOrders"]);

/** Refuse anything that looks like a write, even if it was allowlisted by mistake. */
const WRITE_LIKE =
  /cron\/|logout|close|delete|remove|save|insert|update|upload|import|merge|approve|noatus|edit|\badd|send/i;

export function assertSafe(method, p) {
  if (method === "GET" && READ_GET_PATTERNS.some((re) => re.test(p))) return;
  const allowed = method === "GET" ? READ_GET : method === "POST" ? READ_POST : null;
  if (!allowed?.has(p)) throw new Error(`Refusing ${method} ${p}: not on the read-only allowlist`);
  if (WRITE_LIKE.test(p) && !WRITE_WORD_OK.has(p)) throw new Error(`Refusing ${method} ${p}: looks like a write action`);
}

// ---------------------------------------------------------------------------
// HTTP with a cookie jar, a polite delay, retries and login detection
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jar = new Map();
let lastRequestAt = 0;
let delayMs = 700;

function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

/** Mercury answers an expired session with HTTP 200 and its login page, not a 401. */
export function isLoginPage(html) {
  return /name=["']?Submit_login/i.test(html) && /type=["']?password/i.test(html);
}

class NotLoggedIn extends Error {}

async function request(method, p, form) {
  assertSafe(method, p);
  for (let attempt = 1; ; attempt++) {
    const wait = lastRequestAt + delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(BASE + p, {
        method,
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(form ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
        },
        body: form ? form.toString() : undefined,
        signal: AbortSignal.timeout(180_000),
      });
      storeCookies(res);
      if (res.status >= 300 && res.status < 400) {
        throw new NotLoggedIn(`${method} ${p} redirected to ${res.headers.get("location") || "?"}`);
      }
      if (res.status >= 500 && attempt < 3) {
        await sleep(3000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`${method} ${p} → HTTP ${res.status}`);
      const html = Buffer.from(await res.arrayBuffer()).toString("utf8");
      if (p !== "ajax/index/login" && isLoginPage(html)) {
        throw new NotLoggedIn(`${method} ${p} returned the login page`);
      }
      return html;
    } catch (e) {
      const transient =
        e?.name === "TimeoutError" ||
        /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket/i.test(`${e?.message} ${e?.cause?.code ?? ""}`);
      if (transient && attempt < 3) {
        await sleep(3000 * attempt);
        continue;
      }
      throw e;
    }
  }
}

async function login() {
  const u = process.env.MERCURY_USERNAME;
  const pw = process.env.MERCURY_PASSWORD;
  if (!u || !pw) {
    fail("Add MERCURY_USERNAME and MERCURY_PASSWORD (BDI's own Mercury login) to web/.env.local.");
  }
  jar.clear();
  // Same call Mercury's own login page makes (see its inline jQuery).
  const reply = await request("POST", "ajax/index/login", new URLSearchParams({ u, p: pw }));
  try {
    // The reply's shape isn't documented; a member page loading is the real proof.
    await request("GET", "shop/index/PriceTypeList");
  } catch (e) {
    let said = reply.slice(0, 200);
    try {
      const j = JSON.parse(reply);
      said = JSON.stringify(Object.fromEntries(Object.entries(j).filter(([k]) => !/pass|pwd|token|key/i.test(k))));
    } catch {
      /* not JSON — show the start of it */
    }
    fail(`Mercury login failed (${e.message}). Mercury replied: ${said.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// HTML → rows
// ---------------------------------------------------------------------------

export const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const isEl = (n) => n.nodeType === 1;
const tagOf = (n) => (n.tagName || "").toUpperCase();
const md5 = (s) => createHash("md5").update(s).digest("hex");

/**
 * A table's own rows — not the rows of tables nested inside its cells.
 *
 * Mercury often writes headers as <thead><th>…</th></thead> with no <tr>.
 * Browsers repair that silently; node-html-parser keeps the cells loose, so a
 * run of loose cells is treated as one implicit row, in document order.
 */
export function directRows(table) {
  const rows = [];
  const walk = (parent) => {
    let loose = [];
    const flush = () => {
      if (loose.length) rows.push(implicitRow(loose));
      loose = [];
    };
    for (const n of parent.childNodes.filter(isEl)) {
      const t = tagOf(n);
      if (t === "TD" || t === "TH") {
        loose.push(n);
        continue;
      }
      flush();
      if (t === "TR") rows.push(n);
      else if (t === "THEAD" || t === "TBODY" || t === "TFOOT") walk(n);
    }
    flush();
  };
  walk(table);
  return rows;
}

function implicitRow(cells) {
  return parse(`<table><tr>${cells.map((c) => c.outerHTML).join("")}</tr></table>`).querySelector("tr");
}

/** Presentation-only attributes; everything else Mercury puts on a row/cell is data (ids, totals, lat/lng). */
const NOISE_ATTRS = /^(x:\w+|colspan|rowspan|style|class|width|height|align|valign|bgcolor|nowrap|onclick|title|var)$/i;

function dataAttrs(el) {
  const out = {};
  for (const [k, v] of Object.entries(el.attributes)) if (!NOISE_ATTRS.test(k) && v !== "") out[k] = v;
  return out;
}

function rowInfo(tr) {
  const cells = tr.childNodes.filter((n) => isEl(n) && (tagOf(n) === "TD" || tagOf(n) === "TH"));
  return {
    cells: cells.map((c) => clean(c.text)),
    spans: cells.map((c) => Math.max(1, Number(c.getAttribute("colspan")) || 1)),
    attrs: cells.map(dataAttrs),
    rowAttrs: dataAttrs(tr),
    links: tr
      .querySelectorAll("a")
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => h && !h.startsWith("#") && !/^jav?s?cript/i.test(h)),
  };
}

/** Every table on the page, as arrays of { cells, links } rows. */
export function tablesOf(html) {
  return parse(html)
    .querySelectorAll("table")
    .map((t) => directRows(t).map(rowInfo));
}

/** The first table that has a row containing every one of `labels` as a whole cell. */
export function tableWithHeader(html, labels) {
  for (const rows of tablesOf(html)) {
    const headerIndex = rows.findIndex((r) => labels.every((l) => r.cells.includes(l)));
    if (headerIndex >= 0) return { rows, headerIndex };
  }
  return null;
}

/**
 * For simple lists: the table that looks like data — a row of at least three
 * short labels as its header — with the most rows under that header.
 *
 * "Most rows" alone picks wrong: Mercury wraps every page in layout tables
 * (cells holding the whole page's text) and some pages put a menu table above
 * the data (the promotions page's "add promotion" menu has 8 rows; its data
 * table has 2). The short-label header test rules both out.
 */
export function dataTable(html) {
  let best = { rows: [], headerIndex: -1 };
  let bestCount = -1;
  for (const rows of tablesOf(html)) {
    const headerIndex = rows.findIndex((r) => {
      const filled = r.cells.filter(Boolean);
      return filled.length >= 3 && filled.every((c) => c.length <= 40);
    });
    if (headerIndex < 0) continue;
    const below = rows.length - headerIndex - 1;
    if (below > bestCount) {
      best = { rows, headerIndex };
      bestCount = below;
    }
  }
  return best;
}

/** Header labels made unique and non-empty: "Төрөл", "Төрөл (2)", "col_7". */
export function headerLabels(cells) {
  const seen = new Map();
  return cells.map((c, i) => {
    const base = c || `col_${i}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/**
 * Rows under the header as { label: text } objects. The header is expanded by
 * colspan (the document list has one 2-wide "Хаана" header over two data
 * cells), then only rows with exactly that many plain cells are kept —
 * subtotal and group rows are built from colspans, so they drop out.
 */
export function rowsAsObjects({ rows, headerIndex }) {
  const head = rows[headerIndex];
  if (headerIndex == null || headerIndex < 0 || !head) return [];
  const labels = headerLabels(head.cells.flatMap((c, i) => Array(head.spans[i]).fill(c)));
  // Some lists repeat the header as a footer (<tfoot>); that's not a record.
  const headerText = head.cells.join("\u0001");
  return rows
    .slice(headerIndex + 1)
    .filter((r) => r.cells.length === labels.length && r.spans.every((s) => s === 1) && r.cells.some(Boolean))
    .filter((r) => r.cells.join("\u0001") !== headerText)
    .map((r) => ({
      data: Object.fromEntries(labels.map((l, i) => [l, r.cells[i]])),
      links: r.links,
      cells: r.cells,
      rowAttrs: r.rowAttrs,
    }));
}

export function linkId(links, re) {
  for (const h of links) {
    const m = h.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Row data plus what Mercury hides outside the cell text: the numeric ids in
 * the row's links by link kind ({ View2ShopNoHead: "2872090", ViewOrder:
 * "48297476" }) and the row's own attributes (document rows carry data_id,
 * total and the customer's lat/lng).
 */
export function withIds(item) {
  const out = { ...item.data };
  const ids = {};
  for (const h of item.links) {
    const m = h.match(/\/index\/(\w+)\/(-?\d+)/);
    if (m && !(m[1] in ids)) ids[m[1]] = m[2];
  }
  if (Object.keys(ids).length) out._ids = ids;
  if (item.rowAttrs && Object.keys(item.rowAttrs).length) out._row = item.rowAttrs;
  return out;
}

/**
 * Stable key for a simple-list row: the id in "N : 1234", else the first id in
 * its links, else the row's data_id attribute, else a hash of its cells.
 */
export function defaultKey(item) {
  const m = (item.cells[0] || "").match(/:\s*(\d+)/);
  if (m) return m[1];
  const id = linkId(item.links, /\/(\d{2,})(?:\/|$)/);
  if (id) return id;
  if (item.rowAttrs?.data_id) return item.rowAttrs.data_id;
  return `h:${md5(item.cells.join("|")).slice(0, 16)}`;
}

export function isoDate(s) {
  const m = (s || "").match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * What the browser would submit for a page's search form left untouched: each
 * pre-selected option, checked box, text/hidden value, and the search button.
 * Callers then override only the dates — so "all types / all managers / all
 * categories" stays exactly as Mercury's own defaults define it.
 */
export function formDefaults(html, mustHaveField, selectAll = []) {
  const form = parse(html)
    .querySelectorAll("form")
    .find((f) => f.querySelector(`[name="${mustHaveField}"]`));
  if (!form) return null;
  const params = new URLSearchParams();
  let firstSubmit = null;
  for (const el of form.querySelectorAll("input, select, textarea")) {
    const name = el.getAttribute("name");
    if (!name) continue;
    const t = tagOf(el);
    if (t === "SELECT") {
      const opts = el.querySelectorAll("option");
      // Some filters start empty and an empty filter means "nobody" (the
      // e-Barimt list returns 0 receipts until devices are ticked).
      const chosen = selectAll.includes(name) ? opts : opts.filter((o) => o.hasAttribute("selected"));
      const use = chosen.length ? chosen : el.hasAttribute("multiple") ? [] : opts.slice(0, 1);
      for (const o of use) params.append(name, o.getAttribute("value") ?? clean(o.text));
    } else if (t === "TEXTAREA") {
      params.append(name, el.text);
    } else {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "submit") {
        // Only the first search button, as a real click sends. The document
        // list has two buttons both named "search" ("Хайх" and "XML"); sending
        // both would make PHP see the last one and answer with XML instead.
        if (/^(search|submitSearch)$/.test(name) && !params.has(name)) params.append(name, el.getAttribute("value") ?? "1");
        else firstSubmit ??= [name, el.getAttribute("value") ?? "1"];
        continue;
      }
      if (["button", "image", "reset", "file"].includes(type)) continue;
      if ((type === "checkbox" || type === "radio") && !el.hasAttribute("checked")) continue;
      params.append(name, el.getAttribute("value") ?? "");
    }
  }
  // Forms whose button isn't called "search" (deletedOrders: "submit",
  // Dans_huulga: "search1") still need it sent, as a click would.
  if (!params.has("search") && !params.has("submitSearch") && firstSubmit) params.append(...firstSubmit);
  return params;
}

// ---------------------------------------------------------------------------
// Parsers for each Mercury page (exported so they can be tested offline)
// ---------------------------------------------------------------------------

/**
 * Product list. Row 0 holds column titles, and its 10th cell spans every price
 * column; row 1 names those columns (base price, one per price list, then
 * discount %); each product row has 9 fixed cells, one cell per price column,
 * and a delete button.
 *
 * Every price cell carries cl="<price list id>" (0 = base price), so prices are
 * also kept by Mercury's price-list id: names repeat and get renamed, ids don't.
 */
export function parseProducts(html) {
  const t = tableWithHeader(html, ["Барааны нэр", "Дотоод код"]);
  if (!t) return [];
  const fixed = headerLabels(t.rows[t.headerIndex].cells.slice(0, 9));
  const priceNames = headerLabels(t.rows[t.headerIndex + 1]?.cells ?? []);
  const out = [];
  for (const r of t.rows.slice(t.headerIndex + 2)) {
    if (r.cells.length < fixed.length + priceNames.length) continue;
    const data = Object.fromEntries(fixed.map((h, i) => [h, r.cells[i]]));
    data.prices = {};
    data.prices_by_list_id = {};
    priceNames.forEach((name, i) => {
      const c = fixed.length + i;
      data.prices[name] = r.cells[c];
      if (r.attrs[c]?.cl != null) data.prices_by_list_id[r.attrs[c].cl] = r.cells[c];
    });
    const id = linkId(r.links, /ProductEdit(?:POS)?\/(\d+)/) ?? r.attrs[7]?.product_id ?? null;
    data._ids = {
      ...(id ? { product: id } : {}),
      ...(r.attrs[2]?.cat_id ? { category: r.attrs[2].cat_id } : {}),
    };
    if (r.attrs[8]?.productshow != null) data.show = r.attrs[8].productshow;
    const code = data["Дотоод код"] || data["Бар.код"];
    if (!id && !code) continue;
    out.push({ key: id ?? `code:${code}`, data });
  }
  return out;
}

/** Customer export (hariltsagchid.xls — an HTML table): 20 columns, keyed by Mercury's registration number. */
export function parseCustomers(html) {
  const t = tableWithHeader(html, ["Бүртгэлийн дугаар", "Компани"]);
  if (!t) return [];
  return rowsAsObjects(t)
    .map((it) => ({ key: it.data["Бүртгэлийн дугаар"], data: it.data }))
    .filter((r) => r.key);
}

/** BigData export: one row per document line. Keyed "document:line#" in Mercury's own order. */
export function parseBigData(html) {
  const t = tableWithHeader(html, ["Баримт", "Барааны Код"]);
  if (!t) return [];
  const seq = new Map();
  return rowsAsObjects(t)
    .filter((it) => it.data["Баримт"])
    .map((it) => {
      const doc = it.data["Баримт"];
      const n = (seq.get(doc) || 0) + 1;
      seq.set(doc, n);
      return { key: `${doc}:${n}`, data: it.data, date: isoDate(it.data["Огноо"]) };
    });
}

/** Document list (sales, loadings, returns, warehouse in/out…) with payment type and e-Barimt id. */
export function parseDocuments(html) {
  const t = tableWithHeader(html, ["Дугаар", "НӨАТ-УС"]);
  if (!t) return [];
  return rowsAsObjects(t)
    .filter((it) => /^\d+$/.test(it.data["Дугаар"] || ""))
    .map((it) => ({ key: it.data["Дугаар"], data: withIds(it), date: isoDate(it.data["Өдөр"]) }));
}

/** Store orders (incl. ORDER.ID.MN) with status, deliverer and ordered vs delivered amounts. */
export function parseOrders(html) {
  const t = tableWithHeader(html, ["Захиалгын дүн", "Түгээгч"]);
  if (!t) return [];
  return rowsAsObjects(t)
    .map((it) => {
      const id = linkId(it.links, /noheadViewOrderShop2\w*\/(\d+)/);
      return id ? { key: id, data: withIds(it), date: isoDate(it.data["Захиалсан огноо"]) } : null;
    })
    .filter(Boolean);
}

/** Generic list page (settings lists, users, devices, credits…). */
export function parseSimpleList(html, keyFn = defaultKey) {
  return rowsAsObjects(dataTable(html)).map((it) => ({ key: keyFn(it), data: withIds(it) }));
}

/**
 * Stock report: two header rows — 8 single columns, then four 2-wide groups
 * (opening, in, out, balance) each split into quantity and amount. The
 * product id ends each row's drill-down link (…/2026-11-01,2026-11-04,,144514),
 * which also gives the period the figures cover.
 */
export function parseStock(html) {
  const t = tableWithHeader(html, ["Баркод", "Дотоод.код"]);
  if (!t) return [];
  const top = t.rows[t.headerIndex];
  const sub = t.rows[t.headerIndex + 1]?.cells ?? [];
  const labels = [];
  let s = 0;
  top.cells.forEach((c, i) => {
    if (top.spans[i] > 1) for (let k = 0; k < top.spans[i]; k++) labels.push(`${c} ${sub[s++] ?? k + 1}`);
    else labels.push(c);
  });
  const out = [];
  for (const r of t.rows.slice(t.headerIndex + 2)) {
    if (r.cells.length !== labels.length) continue;
    const data = Object.fromEntries(labels.map((l, i) => [l, r.cells[i]]));
    const id = linkId(r.links, /,(\d+)$/);
    const period = r.links.map((h) => h.match(/(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/)).find(Boolean);
    if (period) data._period = { from: period[1], to: period[2] };
    if (id) data._ids = { product: id };
    const key = id ?? (data["Дотоод.код"] || data["Баркод"]);
    if (key) out.push({ key, data });
  }
  return out;
}

/**
 * Customer card (View2Shop): label/value rows. Besides the raw text it pulls
 * out the fields the website needs, chiefly the contract price list
 * ("Гэрээний үнэ") and the customer's own discount — which is how Mercury
 * decides what each store pays, and isn't in the customer export.
 */
export function parseCustomerDetail(html) {
  const root = parse(html);
  const table = root
    .querySelectorAll("table")
    .find((tb) => !tb.querySelector("table") && tb.text.includes("Бүртгэлийн дугаар"));
  if (!table) return null;
  const data = {};
  const lines = {};
  // Mercury leaves <tr>s unclosed here, so read every row, not just direct children.
  for (const tr of table.querySelectorAll("tr")) {
    const cells = tr.childNodes.filter((n) => isEl(n) && (tagOf(n) === "TD" || tagOf(n) === "TH"));
    if (cells.length !== 2) continue;
    const label = clean(cells[0].text).replace(/\s*:\s*$/, "");
    if (!label || label.length > 40 || label in data) continue;
    data[label] = clean(cells[1].text);
    lines[label] = cells[1].structuredText.split("\n").map(clean).filter(Boolean);
  }
  const parsed = {};
  const company = lines["Компани нэр"] ?? [];
  if (company.length) {
    parsed.company = company.filter((l) => !/^РД\s*:/.test(l)).join(" ");
    const rd = company.join(" ").match(/РД\s*:\s*(\S+)/);
    if (rd) parsed.rd = rd[1];
  }
  const contract = (data["Гэрээний үнэ"] ?? "").match(/^(.*?)\s*Хямдрал\s*:\s*(-?[\d.,]+)\s*%/);
  if (contract) {
    parsed.price_list = contract[1].trim();
    parsed.discount_pct = contract[2].replace(",", ".");
  } else if (data["Гэрээний үнэ"]) parsed.price_list = data["Гэрээний үнэ"];
  const address = (data["Хаяг"] ?? "").match(/Дүүрэг\s*:\s*(.*?)\s*Хаяг\s*:\s*(.*)$/);
  if (address) {
    parsed.district = address[1];
    parsed.address = address[2];
  }
  if (data["Холбоо барих утас"]) parsed.phone = data["Холбоо барих утас"].replace(/[^\d, ]/g, "").trim();
  if (data["Авлага"] != null) parsed.receivable = data["Авлага"];
  return { ...data, _parsed: parsed };
}

/**
 * Product form (ProductEdit) — read, never submitted. Captures what the list
 * page doesn't show: VAT / city-tax flags and the e-Barimt classification and
 * tax codes (needed to issue receipts), unit, "hide from phones", sell-by-box,
 * the ORDER.ID.MN price, and every price list's price and show flag by id.
 */
export function parseProductDetail(html) {
  const root = parse(html);
  const form = root
    .querySelectorAll("form")
    .find((f) => f.querySelector('[name="classificationCode"]') && f.querySelector('[name="price"]'));
  // Mercury's markup is broken enough that a parser may close the <form>
  // early; if the price fields aren't inside it, read the whole page.
  const scope = form ?? root;
  if (!scope.querySelector('[name="barcode"]')) return null;
  const data = { prices_by_list_id: {}, show_by_list_id: {} };
  for (const el of scope.querySelectorAll("input, select, textarea")) {
    const name = el.getAttribute("name");
    if (!name) continue;
    const t = tagOf(el);
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (t === "INPUT" && ["submit", "button", "file", "hidden", "image", "reset"].includes(type)) continue;
    let m;
    if ((m = name.match(/^price_data\[(\d+)\]$/))) {
      data.prices_by_list_id[m[1]] = el.getAttribute("value") ?? "";
    } else if ((m = name.match(/^price_show\[(\d+)\]$/))) {
      data.show_by_list_id[m[1]] = el.hasAttribute("checked");
    } else if (t === "SELECT") {
      const opts = el.querySelectorAll("option");
      const opt = opts.find((o) => o.hasAttribute("selected")) ?? opts[0];
      data[name] = opt ? { value: opt.getAttribute("value") ?? clean(opt.text), text: clean(opt.text) } : null;
    } else if (t === "TEXTAREA") {
      data[name] = el.text;
    } else if (type === "checkbox") {
      data[name] = el.hasAttribute("checked");
    } else if (type === "radio") {
      if (el.hasAttribute("checked")) data[name] = el.getAttribute("value");
    } else {
      data[name] = el.getAttribute("value") ?? "";
    }
  }
  data.images = root
    .querySelectorAll("img")
    .map((i) => i.getAttribute("src") || "")
    .filter((src) => src && !/\/assets\/image\/icons\//.test(src));
  return data;
}

/** Line items of one store order (only needed for orders that never became a document). */
export function parseOrderLines(html) {
  const t = tableWithHeader(html, ["Бараа нэр", "Нийт дүн"]);
  if (!t) return [];
  return rowsAsObjects(t)
    .filter((it) => /^\d+$/.test(it.data["№"] || ""))
    .map((it) => ({ n: it.data["№"], data: it.data }));
}

/**
 * Customer settlement page (View2ShopTootsoo): the unpaid credit sales, bank
 * payments received, and the closing receivable ("Авлага : 3,137,080").
 */
export function parseLedger(html) {
  const out = [];
  const sales = tableWithHeader(html, ["Бэлнээр төлсөн", "Түгээгч"]);
  for (const it of sales ? rowsAsObjects(sales) : []) {
    if (!/^\d+$/.test(it.data["#"] || "")) continue;
    const doc = linkId(it.links, /ViewOrder\/(\d+)/);
    out.push({ key: `sale:${doc ?? it.data["#"]}`, data: { kind: "sale", ...withIds(it) }, date: isoDate(it.data["Огноо"]) });
  }
  const bank = tableWithHeader(html, ["орлогын дүн", "Зарлагын дүн"]);
  for (const it of bank ? rowsAsObjects(bank) : []) {
    if (!/^\d+$/.test(it.data["#"] || "")) continue;
    // Bank rows have no id; hash the content (minus the row number) so keys survive reordering.
    const rest = Object.fromEntries(Object.entries(it.data).filter(([k]) => k !== "#"));
    out.push({
      key: `bank:${md5(JSON.stringify(rest)).slice(0, 16)}`,
      data: { kind: "bank", ...withIds(it) },
      date: isoDate(it.data["Огноо"]),
    });
  }
  const balanceRow = bank?.rows.find((r) => /^Авлага/.test(r.cells[0] || ""));
  if (balanceRow) out.push({ key: "balance", data: { kind: "balance", Авлага: balanceRow.cells.at(-1) }, date: null });
  return out;
}

// ---------------------------------------------------------------------------
// What to pull
// ---------------------------------------------------------------------------

const list = (p, keyFn) => async (ctx, entity) => {
  const html = await request("GET", p);
  await ctx.saveRaw(entity, "all", html);
  return parseSimpleList(html, keyFn);
};

const page = (p, parser) => async (ctx, entity) => {
  const html = await request("GET", p);
  await ctx.saveRaw(entity, "all", html);
  return parser(html);
};

/** Master data: a full snapshot every run. */
const MASTER = [
  { entity: "product", pull: page("shop/index/ProductList", parseProducts) },
  { entity: "price_type", pull: list("shop/index/PriceTypeList") },
  { entity: "product_category", pull: list("shop/index/CategoryList") },
  { entity: "manufacturer", pull: list("shop/index/FactoryList") },
  { entity: "warehouse", pull: list("shop/index/AguulahList") },
  { entity: "keyword", pull: list("shop/index/KeyWordsList") },
  { entity: "sales_plan", pull: list("shop/index/PlanningList") },
  { entity: "visit_plan", pull: list("home/index/PlanningList") },
  { entity: "promotion", pull: list("shop/index/Uramshuulal") },
  { entity: "product_set", pull: list("shop/index/ProductSet") },
  { entity: "customer", pull: page("home/index/shop2XLS", parseCustomers) },
  { entity: "customer_type", pull: list("home/index/shop2types") },
  { entity: "customer_loan", pull: list("home/index/LoanList") },
  // Current stock per product (the report's default period ends today).
  { entity: "stock_balance", pull: page("shop/index/reportAguulahNew", parseStock) },
  { entity: "user", pull: list("home/index/users", (it) => it.data["Хэрэглэгчийн нэр"] || defaultKey(it)) },
  { entity: "device", pull: list("home/index/CarList", (it) => it.data["IMEI код"] || defaultKey(it)) },
  { entity: "gps_point", pull: list("home/index/Points") },
  { entity: "gps_path", pull: list("home/index/Paths") },
  { entity: "gps_area", pull: list("home/index/Talbai") },
];

/**
 * Submit a page's own search form with only the date range changed (plus,
 * for filters that start empty, every option ticked — see formDefaults).
 * Most forms call the dates searchdate/searchdate2; some don't.
 */
async function searchForm(ctx, entity, p, from, to, { selectAll = [], dateFields = ["searchdate", "searchdate2"] } = {}) {
  ctx.forms ??= {};
  if (!ctx.forms[p]) {
    ctx.forms[p] = formDefaults(await request("GET", p), dateFields[0], selectAll);
    if (!ctx.forms[p]) throw new Error(`no date search form on ${p}`);
  }
  const params = new URLSearchParams(ctx.forms[p]);
  params.set(dateFields[0], from);
  params.set(dateFields[1], to);
  const html = await request("POST", p, params);
  await ctx.saveRaw(entity, `${from}_${to}`, html);
  return html;
}

/** Transactional data: pulled month by month across the date window. */
const BY_DATE = [
  {
    entity: "bigdata_line",
    pull: async (ctx, entity, from, to) => {
      // Mercury's own "BigData татах" export with all six record kinds ticked.
      const params = new URLSearchParams([
        ["order", "1"], ["sale", "1"], ["act", "1"], ["local", "1"], ["move", "1"], ["other", "1"],
        ["selday1", from], ["selday2", to], ["search", "Татах"],
      ]);
      const html = await request("POST", "shop/index/BigData", params);
      await ctx.saveRaw(entity, `${from}_${to}`, html);
      return parseBigData(html);
    },
  },
  {
    entity: "document",
    pull: async (ctx, entity, from, to) => parseDocuments(await searchForm(ctx, entity, "shop/index/OrdersList", from, to)),
  },
  {
    entity: "order",
    pull: async (ctx, entity, from, to) => parseOrders(await searchForm(ctx, entity, "home/index/OrderListShop2", from, to)),
  },
  {
    entity: "payment_summary",
    pull: async (ctx, entity, from, to) =>
      parseSimpleList(
        await searchForm(ctx, entity, "shop/index/PaymentList", from, to, { selectAll: ["htSelect[]"] }),
        (it) => `${from}:${defaultKey(it)}`,
      ).map((r) => ({ ...r, date: from })),
  },
  {
    entity: "ebarimt",
    pull: async (ctx, entity, from, to) =>
      parseSimpleList(await searchForm(ctx, entity, "shop/index/Ebarimt", from, to, { selectAll: ["htSelect[]"] })).map(
        (r) => ({ ...r, date: firstDate(r.data) ?? from }),
      ),
  },
  {
    entity: "bank_statement",
    pull: async (ctx, entity, from, to) =>
      parseSimpleList(
        await searchForm(ctx, entity, "home/index/Dans_huulga", from, to, { dateFields: ["date1", "date2"] }),
      ).map((r) => ({ ...r, date: firstDate(r.data) ?? from })),
  },
  // Low-volume logs: one request per year is plenty.
  {
    entity: "customer_comment",
    chunk: "year",
    pull: async (ctx, entity, from, to) =>
      parseSimpleList(
        await searchForm(ctx, entity, "home/index/Shop2Comments", from, to, { selectAll: ["manager[]"] }),
      ).map((r) => ({ ...r, date: firstDate(r.data) ?? from })),
  },
  {
    entity: "deleted_order",
    chunk: "year",
    pull: async (ctx, entity, from, to) =>
      parseSimpleList(
        await searchForm(ctx, entity, "home/index/deletedOrders", from, to, { dateFields: ["orderDate", "orderDate2"] }),
      ).map((r) => ({ ...r, date: firstDate(r.data) ?? from })),
  },
  {
    entity: "card_read",
    chunk: "year",
    pull: async (ctx, entity, from, to) =>
      parseSimpleList(await searchForm(ctx, entity, "home/index/CardHistory", from, to)).map((r) => ({
        ...r,
        date: firstDate(r.data) ?? from,
      })),
  },
];

/** The first date-looking value in a row (rows name their date column differently). */
function firstDate(data) {
  for (const v of Object.values(data)) {
    const d = typeof v === "string" ? isoDate(v) : null;
    if (d) return d;
  }
  return null;
}

/** Read every row of one mirror entity (Supabase returns at most 1,000 per call). */
async function mirrorRows(db, entity) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("mercury_records")
      .select("mercury_key, record_date, data")
      .eq("entity", entity)
      .order("mercury_key")
      .range(from, from + 999);
    if (error) throw new Error(`reading ${entity} from the mirror: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const amount = (s) => Number(String(s ?? "0").replace(/[,\s]/g, "")) || 0;

/**
 * Detail pages, one request per record, driven by ids already in the mirror
 * (so these need the database and run after the lists above). `snapshot`
 * entities cover every record, so absences mean "deleted in Mercury".
 */
const DETAIL = [
  {
    entity: "product_detail",
    snapshot: true,
    targets: async (db) =>
      (await mirrorRows(db, "product")).map((r) => ({ id: r.mercury_key, path: `shop/index/ProductEdit/${r.mercury_key}` })),
    parse: (html, t) => {
      const data = parseProductDetail(html);
      return data ? [{ key: t.id, data }] : [];
    },
  },
  {
    entity: "customer_detail",
    snapshot: true,
    targets: async (db) =>
      (await mirrorRows(db, "customer")).map((r) => ({ id: r.mercury_key, path: `home/index/View2Shop/${r.mercury_key}` })),
    parse: (html, t) => {
      const data = parseCustomerDetail(html);
      return data ? [{ key: t.id, data }] : [];
    },
  },
  {
    // Only orders that never became a document; the rest have lines in BigData.
    entity: "order_line",
    targets: async (db) =>
      (await mirrorRows(db, "order"))
        .filter((r) => !r.data._ids?.ViewOrder && r.data._ids?.View2ShopNoHead)
        .map((r) => ({
          id: r.mercury_key,
          date: r.record_date,
          path: `home/index/noheadViewOrderShop2Mini/${r.mercury_key}/${r.data._ids.View2ShopNoHead}`,
        })),
    parse: (html, t) =>
      parseOrderLines(html).map((l) => ({ key: `${t.id}:${l.n}`, data: { order: t.id, ...l.data }, date: t.date })),
  },
  {
    // Settlement ledgers of the customers who owe money.
    entity: "customer_ledger",
    targets: async (db) =>
      (await mirrorRows(db, "customer"))
        .filter((r) => amount(r.data["Авлага"]) !== 0)
        .map((r) => ({ id: r.mercury_key, path: `home/index/View2ShopTootsoo/${r.mercury_key}` })),
    parse: (html, t) =>
      parseLedger(html).map((l) => ({ key: `${t.id}:${l.key}`, data: { customer: t.id, ...l.data }, date: l.date })),
  },
];

export function yearChunks(from, to) {
  const out = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const start = y === Number(from.slice(0, 4)) ? from : `${y}-01-01`;
    const end = y === Number(to.slice(0, 4)) ? to : `${y}-12-31`;
    out.push([start, end]);
  }
  return out;
}

export function monthChunks(from, to) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const out = [];
  let d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    out.push([iso(d), iso(monthEnd < end ? monthEnd : end)]);
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Storage: raw files + NDJSON always, the database when available
// ---------------------------------------------------------------------------

async function saveRecords(db, runDir, runId, entity, records) {
  // One upsert may not touch the same row twice, so the last occurrence of a key wins.
  const byKey = new Map(records.map((r) => [String(r.key), r]));
  const now = new Date().toISOString();
  const rows = [...byKey.values()].map((r) => ({
    entity,
    mercury_key: String(r.key),
    data: r.data,
    row_hash: md5(JSON.stringify(r.data)),
    record_date: r.date ?? null,
    last_seen_at: now,
    last_run_id: runId,
    missing_since: null,
  }));
  if (rows.length) {
    await appendFile(
      path.join(runDir, `${entity}.ndjson`),
      `${rows.map((r) => JSON.stringify({ key: r.mercury_key, date: r.record_date, data: r.data })).join("\n")}\n`,
    );
  }
  if (!db) return rows.length;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("mercury_records").upsert(rows.slice(i, i + 500), { onConflict: "entity,mercury_key" });
    if (error) throw new Error(`database upsert failed: ${error.message}`);
  }
  return rows.length;
}

/** A master record absent from today's full list was deleted in Mercury; flag it, never delete our copy. */
async function markMissing(db, runId, entity) {
  const { error } = await db
    .from("mercury_records")
    .update({ missing_since: new Date().toISOString() })
    .eq("entity", entity)
    .neq("last_run_id", runId)
    .is("missing_since", null);
  if (error) throw new Error(`marking missing ${entity}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ulaanbaatar" });
}

function parseArgs(argv) {
  const out = { from: "2023-01-01", to: today(), only: null, db: true, delayMs: 700 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") out.from = argv[++i];
    else if (a === "--to") out.to = argv[++i];
    else if (a === "--only") out.only = new Set(argv[++i].split(",").map((s) => s.trim()));
    else if (a === "--no-db") out.db = false;
    else if (a === "--delay") out.delayMs = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node --env-file=.env.local scripts/mercury-sync.mjs [--from YYYY-MM-DD] [--to YYYY-MM-DD]\n" +
          "       [--only entity,entity] [--no-db] [--delay ms]\n\nEntities: " +
          [...MASTER, ...BY_DATE, ...DETAIL].map((e) => e.entity).join(", "),
      );
      process.exit(0);
    } else fail(`Unknown argument: ${a} (try --help)`);
  }
  for (const d of [out.from, out.to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fail(`Bad date: ${d}`);
  if (out.only) {
    const known = new Set([...MASTER, ...BY_DATE, ...DETAIL].map((e) => e.entity));
    for (const e of out.only) if (!known.has(e)) fail(`Unknown entity: ${e} (try --help)`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  delayMs = args.delayMs;
  const runDir = path.join(HERE, ".mercury-data", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(runDir, { recursive: true });

  let db = null;
  let runId = null;
  if (args.db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) fail("Supabase env missing — run with --env-file=.env.local, or pass --no-db.");
    db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db
      .from("mercury_sync_runs")
      .insert({ date_from: args.from, date_to: args.to })
      .select("id")
      .single();
    if (error) {
      console.warn(
        `⚠ Can't write to the database (${error.message}).\n` +
          "  Run docs/fixes/35-mercury-mirror.sql in the Supabase SQL editor, then re-run.\n" +
          "  Continuing with files only.",
      );
      db = null;
    } else runId = data.id;
  }

  console.log(`Mercury → BDI mirror   ${args.from} → ${args.to}   (${db ? "database + files" : "files only"})`);
  console.log(`Raw copy: ${runDir}\n`);
  await login();
  console.log("✓ signed in to Mercury\n");

  const ctx = {
    async saveRaw(entity, label, html) {
      const dir = path.join(runDir, "raw", entity);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${label}.html`), html);
    },
  };
  const wanted = (e) => !args.only || args.only.has(e);
  const stats = {};
  const errors = [];

  /** Run one step; if Mercury dropped the session, sign in again and retry once. */
  async function step(fn) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof NotLoggedIn)) throw e;
      await login();
      return fn();
    }
  }

  for (const { entity, pull } of MASTER.filter((m) => wanted(m.entity))) {
    try {
      const recs = await step(() => pull(ctx, entity));
      stats[entity] = await saveRecords(db, runDir, runId, entity, recs);
      if (db && recs.length) await markMissing(db, runId, entity);
      console.log(`  ${entity.padEnd(18)} ${String(stats[entity]).padStart(7)} rows`);
    } catch (e) {
      errors.push({ entity, error: e.message });
      console.error(`  ✗ ${entity}: ${e.message}`);
    }
  }

  for (const { entity, pull, chunk } of BY_DATE.filter((m) => wanted(m.entity))) {
    const chunks = chunk === "year" ? yearChunks(args.from, args.to) : monthChunks(args.from, args.to);
    let total = 0;
    for (const [from, to] of chunks) {
      try {
        const recs = await step(() => pull(ctx, entity, from, to));
        total += await saveRecords(db, runDir, runId, entity, recs);
        process.stdout.write(`\r  ${entity.padEnd(18)} ${String(total).padStart(7)} rows   (through ${from.slice(0, 7)})`);
      } catch (e) {
        errors.push({ entity, chunk: from.slice(0, 7), error: e.message });
        process.stdout.write(`\n  ✗ ${entity} ${from.slice(0, 7)}: ${e.message}\n`);
      }
    }
    stats[entity] = total;
    process.stdout.write("\n");
  }

  const details = DETAIL.filter((d) => wanted(d.entity));
  if (details.length && !db) console.warn("  ⚠ detail pages read their ids from the mirror database — skipped with --no-db");
  for (const d of db ? details : []) {
    let targets;
    try {
      targets = await d.targets(db);
    } catch (e) {
      errors.push({ entity: d.entity, error: e.message });
      console.error(`  ✗ ${d.entity}: ${e.message}`);
      continue;
    }
    let total = 0;
    let failed = 0;
    let buffer = [];
    for (const [i, t] of targets.entries()) {
      try {
        const html = await step(() => request("GET", t.path));
        await ctx.saveRaw(d.entity, t.id, html);
        const recs = d.parse(html, t);
        if (!recs.length && d.snapshot) throw new Error("page did not parse");
        buffer.push(...recs);
      } catch (e) {
        failed++;
        errors.push({ entity: d.entity, id: t.id, error: e.message });
      }
      // Save as we go so a long run never loses more than a couple of hundred rows.
      if (buffer.length >= 200 || i === targets.length - 1) {
        total += await saveRecords(db, runDir, runId, d.entity, buffer);
        buffer = [];
      }
      process.stdout.write(`\r  ${d.entity.padEnd(18)} ${i + 1}/${targets.length} pages, ${total} rows${failed ? `, ${failed} failed` : ""}`);
    }
    stats[d.entity] = total;
    if (d.snapshot && total && !failed) await markMissing(db, runId, d.entity);
    process.stdout.write("\n");
  }

  const status = errors.length ? (Object.values(stats).some((n) => n > 0) ? "partial" : "failed") : "ok";
  if (db && runId) {
    await db
      .from("mercury_sync_runs")
      .update({ finished_at: new Date().toISOString(), status, stats, errors })
      .eq("id", runId);
  }
  await writeFile(path.join(runDir, "summary.json"), JSON.stringify({ ...args, only: args.only && [...args.only], status, stats, errors }, null, 2));
  console.log(`\n${status === "ok" ? "✓" : "⚠"} ${status}: ${Object.values(stats).reduce((a, b) => a + b, 0)} rows across ${Object.keys(stats).length} record types, ${errors.length} errors`);
  if (errors.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => fail(e?.stack || String(e)));
}
