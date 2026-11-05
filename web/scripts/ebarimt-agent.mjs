#!/usr/bin/env node
/**
 * e-Barimt agent — sends the receipts queued on /admin/ebarimt to PosAPI 3.0.
 *
 * PosAPI 3.0 is a local service the tax office gives a registered merchant
 * (default http://localhost:7080). Vercel can't reach it, so this script
 * runs on the same computer: it polls the website's database for work,
 * talks to PosAPI, and writes the answer (ДДТД, lottery, QR) back.
 * Zero dependencies — only Node 18+ is needed on that computer.
 *
 *   node --env-file=.env.local scripts/ebarimt-agent.mjs            keep running
 *   node --env-file=.env.local scripts/ebarimt-agent.mjs --check    PosAPI + database check, then exit
 *   node --env-file=.env.local scripts/ebarimt-agent.mjs --once     one pass, then exit
 *   node --env-file=.env.local scripts/ebarimt-agent.mjs --dry-run  print what would be sent; sends nothing
 *
 * Env (see docs/ebarimt-setup.md):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   same as the website
 *   POSAPI_URL              default http://localhost:7080
 *   EBARIMT_MERCHANT_TIN    BDI's ТТД (11–12 digits)
 *   EBARIMT_DISTRICT_CODE   4-digit district/branch code registered in PosAPI
 *   EBARIMT_BRANCH_NO       default "001"
 *   EBARIMT_POS_NO          optional — PosAPI knows its own
 *   EBARIMT_TIN_LOOKUP      default https://api.ebarimt.mn/api/info/check/getTinInfo
 *   EBARIMT_INFO_LOOKUP     default https://api.ebarimt.mn/api/info/check/getInfo
 *
 * Safety: a receipt is claimed (queued → sending) with a conditional update
 * so two agents never send it twice. If PosAPI can't be reached at all the
 * receipt goes back to the queue; if the request reached PosAPI but no
 * answer came back, it's marked failed for a human to check in PosAPI
 * rather than re-sent blindly (that could issue a duplicate receipt).
 */

import { pathToFileURL } from "node:url";

const env = (k, d = "") => (process.env[k] ?? d).trim();
const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const POSAPI_URL = env("POSAPI_URL", "http://localhost:7080").replace(/\/$/, "");
const MERCHANT_TIN = env("EBARIMT_MERCHANT_TIN");
const DISTRICT_CODE = env("EBARIMT_DISTRICT_CODE");
const BRANCH_NO = env("EBARIMT_BRANCH_NO", "001");
const POS_NO = env("EBARIMT_POS_NO");
const TIN_LOOKUP = env("EBARIMT_TIN_LOOKUP", "https://api.ebarimt.mn/api/info/check/getTinInfo");
const INFO_LOOKUP = env("EBARIMT_INFO_LOOKUP", "https://api.ebarimt.mn/api/info/check/getInfo");

const POLL_MS = 5000;
const HEARTBEAT_MS = 30000;
const BATCH = 10;

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB"), ...a);

// ---------------------------------------------------------------------------
// Pure helpers (exported for checks)
// ---------------------------------------------------------------------------

/** PosAPI wants a 6-digit suffix unique per receipt; ebarimt_receipts.bill_seq provides it. */
export function billIdSuffix(seq) {
  return String(Number(seq) % 1_000_000).padStart(6, "0");
}

/** The website's body + the merchant fields only this computer knows. */
export function finalBody(request, { merchantTin, branchNo, districtCode, posNo, customerTin, billSeq }) {
  const b2b = request.type === "B2B_RECEIPT";
  const body = {
    ...request,
    branchNo,
    merchantTin,
    districtCode,
    billIdSuffix: billIdSuffix(billSeq),
    receipts: (request.receipts ?? []).map((r) => ({
      ...r,
      merchantTin,
      ...(b2b && customerTin ? { customerTin } : {}),
    })),
  };
  if (posNo) body.posNo = posNo;
  if (b2b) body.customerTin = customerTin;
  return body;
}

const UNREACHABLE = ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "EAI_AGAIN"];

/** Error codes from a fetch failure (Node nests them, sometimes several at once). */
export function errCodes(err) {
  const c = err?.cause;
  const all = [err, c, ...(Array.isArray(c?.errors) ? c.errors : [])];
  return [...new Set(all.map((e) => e?.code).filter(Boolean))];
}

export function errCode(err) {
  return errCodes(err)[0] ?? err?.name ?? "error";
}

/** The connection never opened, so PosAPI can't have received the request → safe to retry. */
export function neverReached(err) {
  const msg = `${err?.message ?? ""} ${err?.cause?.message ?? ""}`;
  return errCodes(err).some((c) => UNREACHABLE.includes(c)) || UNREACHABLE.some((c) => msg.includes(c));
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

async function db(method, pathAndQuery, body, prefer) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`database ${method} ${pathAndQuery.split("?")[0]}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function posapi(method, path, body, timeoutMs = 30000) {
  const res = await fetch(`${POSAPI_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* plain-text answer */
  }
  return { ok: res.ok, status: res.status, data, text };
}

function summarizeInfo(info) {
  if (!info || typeof info !== "object") return null;
  const pick = (k) => (info[k] === undefined ? undefined : info[k]);
  return {
    operatorName: pick("operatorName"),
    operatorTIN: pick("operatorTIN"),
    posId: pick("posId"),
    posNo: pick("posNo"),
    version: pick("version"),
    lastSentDate: pick("lastSentDate"),
    leftLotteries: pick("leftLotteries"),
    merchants: Array.isArray(info.merchants)
      ? info.merchants.map((m) => ({ tin: m?.tin, name: m?.name }))
      : undefined,
  };
}

async function heartbeat() {
  let posapiOk = false;
  let info = null;
  let error = null;
  try {
    const r = await posapi("GET", "/rest/info", undefined, 10000);
    posapiOk = r.ok;
    info = summarizeInfo(r.data);
    if (!r.ok) error = `PosAPI /rest/info: HTTP ${r.status} ${r.text.slice(0, 200)}`;
  } catch (e) {
    error = `PosAPI (${POSAPI_URL}) холбогдохгүй: ${errCode(e)}`;
  }
  if (!MERCHANT_TIN) error = `${error ? `${error} · ` : ""}EBARIMT_MERCHANT_TIN тохируулаагүй`;
  await db(
    "POST",
    "ebarimt_agent_status?on_conflict=id",
    { id: "main", last_seen_at: new Date().toISOString(), posapi_ok: posapiOk && !!MERCHANT_TIN, info, error },
    "resolution=merge-duplicates,return=minimal",
  );
  return { posapiOk, info, error };
}

/** РД → ТТД through the tax office's public lookup (cached on the store). */
async function resolveTin(registry) {
  const reg = String(registry ?? "").trim().toUpperCase();
  if (/^\d{11,12}$/.test(reg)) return reg;
  if (!reg) throw new Error("Дэлгүүрийн РД алга — B2B баримтад ТТД хэрэгтэй.");
  const res = await fetch(`${TIN_LOOKUP}?regNo=${encodeURIComponent(reg)}`, { signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }
  const tin = data?.data ?? null;
  if (!res.ok || (data?.status && Number(data.status) !== 200) || !tin) {
    throw new Error(`РД ${reg}-ээр ТТД олдсонгүй (${data?.msg ?? `HTTP ${res.status}`}).`);
  }
  return String(tin);
}

async function taxpayerName(tin) {
  try {
    const res = await fetch(`${INFO_LOOKUP}?tin=${encodeURIComponent(tin)}`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    // {"status":200,"data":{"name":"Хулан-Уул","vatPayer":true,…}}
    const name = data?.data?.name ?? data?.name;
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

/** queued → sending (or return_queued → returning) only if nobody else took it. */
async function claim(row, from, to) {
  const rows = await db(
    "PATCH",
    `ebarimt_receipts?id=eq.${row.id}&status=eq.${from}`,
    { status: to, attempts: (row.attempts ?? 0) + 1 },
    "return=representation",
  );
  return rows?.[0] ?? null;
}

async function update(id, patch) {
  await db("PATCH", `ebarimt_receipts?id=eq.${id}`, patch, "return=minimal");
}

async function customerTinFor(row) {
  if (row.receipt_type !== "B2B_RECEIPT") return null;
  if (row.customer_tin) return row.customer_tin;
  const [order] = await db(
    "GET",
    `orders?id=eq.${row.order_id}&select=supermarket_id,store:supermarket_id(id,name,registry_number,ebarimt_tin)`,
  );
  const store = order?.store;
  if (store?.ebarimt_tin) return store.ebarimt_tin;
  const tin = await resolveTin(row.registry_number ?? store?.registry_number);
  if (store?.id) {
    const name = await taxpayerName(tin);
    await db("PATCH", `supermarkets?id=eq.${store.id}`, { ebarimt_tin: tin, ebarimt_name: name }, "return=minimal");
  }
  return tin;
}

async function sendOne(row, { dryRun }) {
  const label = `${row.request?.type ?? row.receipt_type} ${row.total_amount}₮ (${row.id.slice(0, 8)})`;
  if (dryRun) {
    const customerTin = row.customer_tin ?? "(ТТД хайгдана)";
    const body = finalBody(row.request, {
      merchantTin: MERCHANT_TIN || "(EBARIMT_MERCHANT_TIN)",
      branchNo: BRANCH_NO,
      districtCode: DISTRICT_CODE || "(EBARIMT_DISTRICT_CODE)",
      posNo: POS_NO,
      customerTin,
      billSeq: row.bill_seq,
    });
    log(`[dry-run] would send ${label}:\n${JSON.stringify(body, null, 2)}`);
    return;
  }

  const claimed = await claim(row, "queued", "sending");
  if (!claimed) return; // someone else took it

  let customerTin = null;
  try {
    customerTin = await customerTinFor(claimed);
  } catch (e) {
    await update(claimed.id, { status: "failed", error: e.message });
    log(`✗ ${label}: ${e.message}`);
    return;
  }

  const body = finalBody(claimed.request, {
    merchantTin: MERCHANT_TIN,
    branchNo: BRANCH_NO,
    districtCode: DISTRICT_CODE,
    posNo: POS_NO,
    customerTin,
    billSeq: claimed.bill_seq,
  });

  let r;
  try {
    r = await posapi("POST", "/rest/receipt", body);
  } catch (e) {
    if (neverReached(e)) {
      await update(claimed.id, { status: "queued", error: `PosAPI холбогдохгүй (${errCode(e)}) — дахин оролдоно.` });
      log(`… ${label}: PosAPI unreachable, back in queue`);
    } else {
      await update(claimed.id, {
        status: "failed",
        error: `PosAPI-аас хариу ирсэнгүй (${errCode(e)}). Давхардахаас сэргийлж дахин илгээсэнгүй — PosAPI-д шалгаад дахин илгээнэ үү.`,
      });
      log(`✗ ${label}: no answer from PosAPI — marked failed for a manual check`);
    }
    return;
  }

  const d = r.data ?? {};
  if (r.ok && d.status === "SUCCESS" && d.id) {
    await update(claimed.id, {
      status: "sent",
      bill_id: String(d.id),
      lottery: d.lottery ?? null,
      qr_data: d.qrData ?? null,
      receipt_date: d.date ?? null,
      response: d,
      customer_tin: customerTin,
      sent_at: new Date().toISOString(),
      error: null,
    });
    log(`✓ ${label}: ДДТД ${d.id}`);
  } else {
    const message = d.message ?? d.msg ?? (r.text ? r.text.slice(0, 300) : `HTTP ${r.status}`);
    await update(claimed.id, {
      status: "failed",
      response: r.data ?? { text: r.text.slice(0, 2000), httpStatus: r.status },
      customer_tin: customerTin,
      error: `PosAPI: ${message}`,
    });
    log(`✗ ${label}: ${message}`);
  }
}

async function returnOne(row, { dryRun }) {
  const label = `ДДТД ${row.bill_id}`;
  if (dryRun) {
    log(`[dry-run] would return ${label} (date ${row.receipt_date})`);
    return;
  }
  const claimed = await claim(row, "return_queued", "returning");
  if (!claimed) return;
  let r;
  try {
    r = await posapi("DELETE", "/rest/receipt", { id: claimed.bill_id, date: claimed.receipt_date });
  } catch (e) {
    await update(claimed.id, {
      status: neverReached(e) ? "return_queued" : "sent",
      error: neverReached(e)
        ? `PosAPI холбогдохгүй (${errCode(e)}) — дахин оролдоно.`
        : `Буцаахад PosAPI хариу өгсөнгүй (${errCode(e)}) — PosAPI-д шалгана уу.`,
    });
    log(`… ${label}: return not confirmed`);
    return;
  }
  const d = r.data ?? {};
  if (r.ok && d.status !== "ERROR") {
    await update(claimed.id, { status: "returned", returned_at: new Date().toISOString(), error: null });
    log(`✓ returned ${label}`);
  } else {
    const message = d.message ?? d.msg ?? (r.text ? r.text.slice(0, 300) : `HTTP ${r.status}`);
    await update(claimed.id, { status: "sent", error: `Буцаах амжилтгүй: ${message}` });
    log(`✗ return ${label}: ${message}`);
  }
}

/** After a crash: anything mid-flight needs a human look, never a blind resend. */
async function recoverStuck() {
  const stuckSends = await db("GET", "ebarimt_receipts?status=eq.sending&select=id");
  for (const r of stuckSends ?? []) {
    await update(r.id, {
      status: "failed",
      error: "Агент илгээх үед тасарсан. PosAPI-д баримт үүссэн эсэхийг шалгаад дахин илгээнэ үү.",
    });
  }
  const stuckReturns = await db("GET", "ebarimt_receipts?status=eq.returning&select=id");
  for (const r of stuckReturns ?? []) {
    await update(r.id, { status: "sent", error: "Буцаах дуусаагүй — дахин буцаана уу." });
  }
  const n = (stuckSends?.length ?? 0) + (stuckReturns?.length ?? 0);
  if (n) log(`recovered ${n} receipt(s) left mid-flight by a previous run`);
}

async function pass({ dryRun }) {
  const queued = await db(
    "GET",
    `ebarimt_receipts?status=eq.queued&order=queued_at.asc&limit=${BATCH}&select=id,bill_seq,order_id,receipt_type,registry_number,customer_tin,total_amount,request,attempts`,
  );
  for (const row of queued ?? []) await sendOne(row, { dryRun });

  const returns = await db(
    "GET",
    `ebarimt_receipts?status=eq.return_queued&order=return_requested_at.asc&limit=${BATCH}&select=id,bill_id,receipt_date,attempts`,
  );
  for (const row of returns ?? []) await returnOne(row, { dryRun });

  const did = (queued?.length ?? 0) + (returns?.length ?? 0);
  if (did > 0 && !dryRun) {
    // Push to the tax office now rather than waiting for PosAPI's own schedule.
    try {
      await posapi("GET", "/rest/sendData", undefined, 60000);
    } catch {
      /* PosAPI retries on its own */
    }
  }
  return did;
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  if (!SUPABASE_URL || !SERVICE_KEY) fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run with --env-file=.env.local");

  if (args.has("--check")) {
    const hb = await heartbeat();
    console.log(`PosAPI ${POSAPI_URL}: ${hb.posapiOk ? "OK" : "NOT OK"}`);
    if (hb.info) console.log(JSON.stringify(hb.info, null, 2));
    if (hb.error) console.log(`Problem: ${hb.error}`);
    const queued = await db("GET", "ebarimt_receipts?status=in.(queued,return_queued)&select=id");
    console.log(`Database OK · ${queued?.length ?? 0} receipt(s) waiting`);
    console.log(`Merchant TIN: ${MERCHANT_TIN || "(not set)"} · district ${DISTRICT_CODE || "(not set)"} · branch ${BRANCH_NO}`);
    return;
  }

  if (!dryRun && !MERCHANT_TIN) fail("EBARIMT_MERCHANT_TIN is not set (BDI's ТТД).");
  if (!dryRun && !DISTRICT_CODE) fail("EBARIMT_DISTRICT_CODE is not set (4-digit code from PosAPI registration).");

  if (!dryRun) await recoverStuck();
  if (args.has("--once") || dryRun) {
    if (!dryRun) await heartbeat();
    const n = await pass({ dryRun });
    log(`done · ${n} item(s)`);
    return;
  }

  log(`e-Barimt agent · PosAPI ${POSAPI_URL} · merchant ${MERCHANT_TIN}`);
  let lastBeat = 0;
  for (;;) {
    try {
      if (Date.now() - lastBeat > HEARTBEAT_MS) {
        const hb = await heartbeat();
        lastBeat = Date.now();
        if (hb.error) log(`! ${hb.error}`);
      }
      await pass({ dryRun: false });
    } catch (e) {
      log(`! ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => fail(e?.stack || String(e)));
}
