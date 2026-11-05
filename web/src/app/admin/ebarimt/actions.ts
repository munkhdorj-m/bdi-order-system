"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError, getSession } from "@/lib/auth";
import { loadDocOrders } from "@/lib/order-docs";
import { buildReceipt, LIVE_STATUSES } from "@/lib/ebarimt";

/**
 * e-Barimt queue — Mercury's "НӨАТУС V3" buttons. The website only queues;
 * the agent next to PosAPI (web/scripts/ebarimt-agent.mjs) does the
 * sending and writes back the ДДТД, so these return immediately.
 */

export type QueueResult = {
  queued: number;
  skipped: { order: string; reason: string }[];
  warnings: string[];
  error?: string;
};

function refresh() {
  revalidatePath("/admin/ebarimt");
}

export async function queueReceipts(orderIds: string[]): Promise<QueueResult> {
  const empty: QueueResult = { queued: 0, skipped: [], warnings: [] };
  const guardErr = await adminGuardError();
  if (guardErr) return { ...empty, error: guardErr };
  const session = await getSession();

  const ids = [...new Set((orderIds ?? []).filter((x) => typeof x === "string" && x))].slice(0, 300);
  if (ids.length === 0) return { ...empty, error: "Захиалга сонгоно уу." };

  const supabase = await createClient();
  let orders;
  try {
    orders = await loadDocOrders(supabase, { orderIds: ids });
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }

  const { data: live, error: liveErr } = await supabase
    .from("ebarimt_receipts")
    .select("order_id")
    .in("order_id", ids)
    .in("status", LIVE_STATUSES);
  if (liveErr) return { ...empty, error: liveErr.message };
  const hasLive = new Set((live ?? []).map((r) => r.order_id as string));

  const result: QueueResult = { ...empty };
  for (const o of orders) {
    if (o.status !== "shipped" && o.status !== "delivered") {
      result.skipped.push({ order: o.order_number, reason: "Ачилт хаагдаагүй байна." });
      continue;
    }
    if (hasLive.has(o.id)) {
      result.skipped.push({ order: o.order_number, reason: "Е-баримт аль хэдийн илгээгдсэн эсвэл дараалалд байна." });
      continue;
    }
    const built = buildReceipt({
      lines: o.items.map((i) => ({
        name: i.name,
        sku: i.product?.sku ?? null,
        unit: i.product?.unit ?? null,
        qty: i.qty,
        unitPrice: i.unit_price,
        vatPayable: i.product?.vat_payable ?? null,
        cityTax: i.product?.city_tax ?? null,
        classificationCode: i.product?.ebarimt_class_code ?? null,
        taxProductCode: i.product?.ebarimt_tax_code ?? null,
      })),
      discountTotal: o.discount_total,
      registryNumber: o.store?.registry_number || o.store?.ebarimt_tin,
    });
    if (built.problems.length > 0) {
      result.skipped.push({ order: o.order_number, reason: built.problems.join(" ") });
      continue;
    }
    const { error } = await supabase.from("ebarimt_receipts").insert({
      order_id: o.id,
      status: "queued",
      receipt_type: built.type,
      registry_number: built.registryNumber,
      customer_tin: built.type === "B2B_RECEIPT" ? (o.store?.ebarimt_tin ?? null) : null,
      total_amount: built.totalAmount,
      total_vat: built.totalVat,
      total_city_tax: built.totalCityTax,
      request: built.request,
      queued_by: session?.userId ?? null,
    });
    if (error) {
      result.skipped.push({
        order: o.order_number,
        reason: /duplicate|unique/i.test(error.message) ? "Аль хэдийн дараалалд орсон." : error.message,
      });
      continue;
    }
    result.queued += 1;
    for (const w of built.warnings) result.warnings.push(`${o.order_number}: ${w}`);
  }

  refresh();
  return result;
}

/** Буцаах — ask the agent to cancel a sent receipt in PosAPI. */
export async function requestReturn(receiptId: string): Promise<{ error?: string }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const session = await getSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebarimt_receipts")
    .update({
      status: "return_queued",
      return_requested_by: session?.userId ?? null,
      return_requested_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", receiptId)
    .eq("status", "sent")
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Зөвхөн илгээсэн баримтыг буцаах боломжтой." };
  refresh();
  return {};
}

/** Take back a send or return request the agent hasn't picked up yet. */
export async function cancelRequest(receiptId: string): Promise<{ error?: string }> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  const supabase = await createClient();

  const { data: removed, error: delErr } = await supabase
    .from("ebarimt_receipts")
    .delete()
    .eq("id", receiptId)
    .eq("status", "queued")
    .select("id");
  if (delErr) return { error: delErr.message };
  if (removed && removed.length > 0) {
    refresh();
    return {};
  }

  const { data: back, error: backErr } = await supabase
    .from("ebarimt_receipts")
    .update({ status: "sent", return_requested_by: null, return_requested_at: null })
    .eq("id", receiptId)
    .eq("status", "return_queued")
    .select("id");
  if (backErr) return { error: backErr.message };
  if (!back || back.length === 0) return { error: "Агент аль хэдийн эхэлсэн тул цуцлах боломжгүй." };
  refresh();
  return {};
}
