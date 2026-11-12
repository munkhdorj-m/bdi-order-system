"use server";

import { createClient } from "@/lib/supabase/server";
import { adminGuardError } from "@/lib/auth";
import { isIsoDay } from "@/lib/dispatch";
import { loadDocOrders } from "@/lib/order-docs";
import { buildDayansoftBatch, type DayansoftOptions } from "@/lib/dayansoft";

export type DayansoftCheck = {
  error?: string;
  documents?: number;
  lines?: number;
  total?: number;
  /** Missing codes and the like — worth fixing before the accountant imports the file. */
  warnings?: string[];
};

/**
 * What the Dayansoft file for a range of delivery days would hold — shown
 * before downloading, because a spreadsheet can't carry "3 customers have
 * no code" back to the person who made it.
 */
export async function checkDayansoft(input: {
  from: string;
  to: string;
  account: string;
  partnerCode: DayansoftOptions["partnerCode"];
  itemCode: DayansoftOptions["itemCode"];
}): Promise<DayansoftCheck> {
  const guardErr = await adminGuardError();
  if (guardErr) return { error: guardErr };
  if (!isIsoDay(input.from) || !isIsoDay(input.to)) return { error: "Эхлэх, дуусах өдрөө сонгоно уу." };
  const [from, to] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from];

  try {
    const orders = await loadDocOrders(await createClient(), { soldFrom: from, soldTo: to });
    const batch = buildDayansoftBatch(orders, {
      account: String(input.account ?? "").slice(0, 40),
      partnerCode: input.partnerCode === "mercury" ? "mercury" : "registry",
      itemCode: input.itemCode === "barcode" ? "barcode" : "internal",
    });
    return { documents: batch.documents, lines: batch.lines, total: batch.total, warnings: batch.warnings };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
