"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminGuardError, getSession } from "@/lib/auth";
import { loadDocOrders } from "@/lib/order-docs";
import { buildReceipt, EBARIMT_QUEUE_BATCH, LIVE_STATUSES } from "@/lib/ebarimt";

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
  revalidatePath("/admin");
}

export async function queueReceipts(orderIds: string[]): Promise<QueueResult> {
  const empty: QueueResult = { queued: 0, skipped: [], warnings: [] };
  const guardErr = await adminGuardError();
  if (guardErr) return { ...empty, error: guardErr };
  const session = await getSession();

  const ids = [...new Set((orderIds ?? []).filter((x) => typeof x === "string" && x))];
  if (ids.length === 0) return { ...empty, error: "Захиалга сонгоно уу." };
  // Never drop the rest quietly — the page sends big selections in batches.
  if (ids.length > EBARIMT_QUEUE_BATCH) {
    return { ...empty, error: `Нэг удаад ${EBARIMT_QUEUE_BATCH} хүртэл захиалга илгээнэ.` };
  }

  const supabase = await createClient();
  let orders;
  try {
    orders = await loadDocOrders(supabase, { orderIds: ids });
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const liveParts = await Promise.all(
    chunks.map((chunk) =>
      supabase.from("ebarimt_receipts").select("order_id").in("order_id", chunk).in("status", LIVE_STATUSES),
    ),
  );
  const liveErr = liveParts.find((p) => p.error)?.error;
  if (liveErr) return { ...empty, error: liveErr.message };
  const hasLive = new Set(liveParts.flatMap((p) => (p.data ?? []).map((r) => r.order_id as string)));

  const result: QueueResult = { ...empty };
  const found = new Set(orders.map((o) => o.id));
  const missing = ids.filter((id) => !found.has(id)).length;
  if (missing > 0) result.warnings.push(`${missing} захиалга олдсонгүй.`);

  // Build every receipt first, then write them in one request.
  const toInsert: { order: string; warnings: string[]; row: Record<string, unknown> }[] = [];
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
    toInsert.push({
      order: o.order_number,
      warnings: built.warnings,
      row: {
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
      },
    });
  }

  const accept = (t: (typeof toInsert)[number]) => {
    result.queued += 1;
    for (const w of t.warnings) result.warnings.push(`${t.order}: ${w}`);
  };
  if (toInsert.length > 0) {
    const { error } = await supabase.from("ebarimt_receipts").insert(toInsert.map((t) => t.row));
    if (!error) {
      toInsert.forEach(accept);
    } else {
      // Usually one order got queued meanwhile (one live receipt per
      // order) — retry one by one so the rest still go.
      for (const t of toInsert) {
        const { error: oneErr } = await supabase.from("ebarimt_receipts").insert(t.row);
        if (oneErr) {
          result.skipped.push({
            order: t.order,
            reason: /duplicate|unique/i.test(oneErr.message) ? "Аль хэдийн дараалалд орсон." : oneErr.message,
          });
        } else {
          accept(t);
        }
      }
    }
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
