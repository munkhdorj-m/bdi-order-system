import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { planCorrection, MAX_LINES, type CatalogEntry, type CurrentLine, type LineChange } from "@/lib/orders/correction";
import { rulesAtOrderTime } from "@/lib/orders/deals";
import { isUuid } from "@/lib/orders/write";
import { isBuyerPaymentMethod, type PaymentMethod } from "@/lib/payment-method";
import type { OrderStatus } from "@/lib/order-status";

/**
 * Correct an order after it was placed: other quantities at delivery, a
 * product taken off or added. (In Mercury about one order in seven is
 * delivered differently from how it was ordered.)
 *
 * The caller decides WHO may do this and in which statuses; this decides
 * WHAT is written: prices of existing lines stay, a new product gets the
 * store's price of today, and a store's own order has its deals worked out
 * again. The write itself is one database function
 * (replace_order_lines, docs/fixes/43) so the lines, the discount and the
 * record of the change land together or not at all.
 */

export const FIX_43_HINT =
  "Өгөгдлийн сангийн шинэчлэл хэрэгтэй: docs/fixes/43-mercury-replacement.sql-ийг Supabase SQL Editor дээр нэг удаа ажиллуулна уу.";

/** Is this database error "fix 43 hasn't been run yet"? */
export function needsFix43(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`;
  return (
    /PGRST202|PGRST204|PGRST205|42883|42703|42P01/.test(text) ||
    /replace_order_lines|order_changes|ordered_total|profile_id/.test(text)
  );
}

export type CorrectResult =
  | { error: string }
  | { ok: true; changed: boolean; orderNumber: string; totalBefore: number; totalAfter: number };

const WRITE_ERRORS: Record<string, string> = {
  not_found: "Захиалга олдсонгүй.",
  cancelled: "Цуцлагдсан захиалгыг засах боломжгүй.",
  changed: "Захиалга дөнгөж сая өөрчлөгдсөн байна. Хуудсаа сэргээгээд дахин оролдоно уу.",
  receipt:
    "Е-баримт илгээгдсэн эсвэл дараалалд байгаа тул засах боломжгүй. Эхлээд Е-баримт хуудсаас баримтыг буцаана уу.",
  empty: "Захиалгад дор хаяж нэг бараа үлдэх ёстой.",
  bad_lines: "Барааны мэдээлэл буруу байна. Хуудсаа сэргээгээд дахин оролдоно уу.",
};

export async function correctOrder(input: {
  orderId: string;
  changes: LineChange[];
  reason: string | null;
  actorId: string;
  /** Statuses this caller may correct an order in. */
  allowedStatuses: OrderStatus[];
  /** orders.updated_at as the editor saw it — a change since then is refused. */
  expectedUpdatedAt?: string | null;
  /** false: only quantities of lines already on the order (the delivery screen). */
  mayAddProducts?: boolean;
}): Promise<CorrectResult> {
  if (!isUuid(input.orderId)) return { error: WRITE_ERRORS.not_found };
  if (!Array.isArray(input.changes) || input.changes.length === 0) return { error: "Өөрчлөлт алга." };
  if (input.changes.length > MAX_LINES * 2) return { error: "Хэт олон өөрчлөлт." };
  for (const c of input.changes) {
    if (!c || !isUuid(c.product_id)) return { error: "Бараа олдсонгүй." };
  }

  const admin = createAdminClient();
  const [{ data: order, error: orderErr }, { data: items, error: itemsErr }] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, status, supermarket_id, payment_method, discount_total, created_at, updated_at, placer:placed_by(role)")
      .eq("id", input.orderId)
      .maybeSingle(),
    admin
      .from("order_items")
      .select("product_id, product_name_snapshot, qty, unit_price, products(category_id)")
      .eq("order_id", input.orderId),
  ]);
  if (orderErr || itemsErr) return { error: (orderErr ?? itemsErr)!.message };
  if (!order) return { error: WRITE_ERRORS.not_found };
  if (!input.allowedStatuses.includes(order.status as OrderStatus)) {
    return {
      error:
        order.status === "cancelled" ? WRITE_ERRORS.cancelled : "Энэ төлөвтэй захиалгыг эндээс засах боломжгүй.",
    };
  }

  const current: CurrentLine[] = (items ?? []).map((i) => ({
    product_id: i.product_id as string,
    name: i.product_name_snapshot as string,
    qty: Number(i.qty),
    unit_price: Number(i.unit_price),
    category_id: (i.products as unknown as { category_id: string | null } | null)?.category_id ?? null,
  }));
  const onOrder = new Set(current.filter((l) => l.unit_price > 0).map((l) => l.product_id));
  const adding = input.changes.filter((c) => Number(c.qty) > 0 && !onOrder.has(c.product_id)).map((c) => c.product_id);
  if (adding.length > 0 && input.mayAddProducts === false) {
    return { error: "Шинэ бараа нэмэхийг оффисоос хийнэ. Эндээс зөвхөн тоог өөрчилнө." };
  }

  // Today's price for anything being added, from the store's own price list.
  const catalog = new Map<string, CatalogEntry>();
  if (adding.length > 0) {
    const { data: priced, error } = await admin
      .from("supermarket_prices")
      .select("product_id, name, effective_price, category_id")
      .eq("supermarket_id", order.supermarket_id as string)
      .in("product_id", adding);
    if (error) return { error: error.message };
    for (const p of priced ?? []) {
      catalog.set(p.product_id as string, {
        name: p.name as string,
        price: Number(p.effective_price) || 0,
        category_id: (p.category_id as string | null) ?? null,
      });
    }
  }

  // A store's own order carries deals (sale prices, the cash discount, free
  // gifts); they follow the corrected quantities. Orders the office or a
  // rep entered have none.
  const placer = order.placer as unknown as { role: string } | null;
  let deals: Parameters<typeof planCorrection>[0]["deals"] = null;
  if (placer?.role === "buyer") {
    const rules = await rulesAtOrderTime(admin, order.supermarket_id as string, order.created_at as string);
    const giftIds = [...new Set(rules.map((r) => r.product_id).filter((v): v is string => !!v))];
    const names = new Map<string, string>();
    if (giftIds.length > 0) {
      const { data } = await admin.from("products").select("id, name").in("id", giftIds);
      for (const p of data ?? []) names.set(p.id as string, p.name as string);
    }
    const payment: PaymentMethod = isBuyerPaymentMethod(order.payment_method) ? order.payment_method : "credit";
    deals = { rules, payment, giftName: (id) => names.get(id) };
  }

  const plan = planCorrection({
    current,
    currentDiscount: Number(order.discount_total) || 0,
    changes: input.changes,
    catalog,
    deals,
  });
  if ("error" in plan) return { error: plan.error };
  const orderNumber = order.order_number as string;
  if (!plan.changed) {
    return { ok: true, changed: false, orderNumber, totalBefore: plan.totalBefore, totalAfter: plan.totalAfter };
  }

  const { data: written, error: writeErr } = await admin.rpc("replace_order_lines", {
    p_order_id: input.orderId,
    p_lines: plan.lines,
    p_discount_total: plan.discountTotal,
    p_changed_by: input.actorId,
    p_reason: input.reason?.trim().slice(0, 300) || null,
    p_expected_updated_at: input.expectedUpdatedAt || (order.updated_at as string),
  });
  if (writeErr) return { error: needsFix43(writeErr) ? FIX_43_HINT : writeErr.message };
  const answer = written as { ok?: boolean; error?: string; total_before?: number; total_after?: number } | null;
  if (!answer?.ok) {
    return { error: WRITE_ERRORS[answer?.error ?? ""] ?? "Засварыг хадгалж чадсангүй. Дахин оролдоно уу." };
  }
  return {
    ok: true,
    changed: true,
    orderNumber,
    totalBefore: Number(answer.total_before ?? plan.totalBefore),
    totalAfter: Number(answer.total_after ?? plan.totalAfter),
  };
}
