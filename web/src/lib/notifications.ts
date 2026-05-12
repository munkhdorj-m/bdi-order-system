// Server-only. Sends "new order" notifications via Resend's HTTP API.
// Designed to be fire-and-forget: any error here is logged and swallowed
// so a flaky mailer never blocks an order from being placed.

import "server-only";
import { formatMnt } from "./format";

type LineItem = {
  product_name_snapshot: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

type NewOrderEmailInput = {
  orderId: string;
  orderNumber: string;
  storeName: string;
  buyerName: string | null;
  buyerEmail: string | null;
  placedByRole: "buyer" | "rep";
  notes: string | null;
  subtotal: number;
  items: LineItem[];
};

function getRecipients(): string[] {
  const raw = process.env.ORDER_NOTIFY_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(input: NewOrderEmailInput, adminUrl: string): string {
  const rows = input.items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(i.product_name_snapshot)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${i.qty}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${formatMnt(i.unit_price)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${formatMnt(i.line_total)}</td>
        </tr>`,
    )
    .join("");

  const placedBy =
    input.placedByRole === "rep" ? "Төлөөлөгчөөр илгээгдсэн" : "Худалдан авагч";
  const buyer = input.buyerName || input.buyerEmail || "—";

  return `
<!doctype html>
<html lang="mn">
  <body style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px;background:#fafafa">
    <h1 style="font-size:18px;margin:0 0 4px">Шинэ захиалга</h1>
    <p style="color:#666;font-size:13px;margin:0 0 16px">
      <strong style="font-family:ui-monospace,monospace">${escapeHtml(input.orderNumber)}</strong>
      · ${escapeHtml(input.storeName)} · ${escapeHtml(placedBy)}
    </p>

    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden;font-size:13px">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="text-align:left;padding:8px 12px">Бараа</th>
          <th style="text-align:right;padding:8px 12px">Тоо</th>
          <th style="text-align:right;padding:8px 12px">Үнэ</th>
          <th style="text-align:right;padding:8px 12px">Дүн</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f9f9f9">
          <td colspan="3" style="text-align:right;padding:10px 12px;font-weight:600">Нийт</td>
          <td style="text-align:right;padding:10px 12px;font-weight:600">${formatMnt(input.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <p style="font-size:13px;color:#444;margin:16px 0 4px"><strong>Захиалсан:</strong> ${escapeHtml(buyer)}</p>
    ${
      input.notes
        ? `<p style="font-size:13px;color:#444;margin:8px 0"><strong>Тэмдэглэл:</strong> ${escapeHtml(input.notes)}</p>`
        : ""
    }

    <p style="margin-top:24px">
      <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:500">
        Захиалга үзэх →
      </a>
    </p>
  </body>
</html>`;
}

function buildText(input: NewOrderEmailInput, adminUrl: string): string {
  const lines = [
    `Шинэ захиалга: ${input.orderNumber}`,
    `Дэлгүүр: ${input.storeName}`,
    `Захиалсан: ${input.buyerName ?? input.buyerEmail ?? "—"}${input.placedByRole === "rep" ? " (төлөөлөгчөөр)" : ""}`,
    "",
    "Бараа:",
    ...input.items.map(
      (i) =>
        `  - ${i.product_name_snapshot} × ${i.qty} = ${formatMnt(i.line_total)}`,
    ),
    "",
    `Нийт: ${formatMnt(input.subtotal)}`,
  ];
  if (input.notes) lines.push("", `Тэмдэглэл: ${input.notes}`);
  lines.push("", `Захиалга үзэх: ${adminUrl}`);
  return lines.join("\n");
}

export async function sendNewOrderEmail(
  input: NewOrderEmailInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = getRecipients();
  const from = process.env.ORDER_NOTIFY_FROM || "onboarding@resend.dev";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!apiKey || recipients.length === 0) {
    // Configured to skip — silently return.
    return;
  }

  const adminUrl = `${siteUrl}/admin/orders/${input.orderId}`;
  const subject = `Шинэ захиалга: ${input.orderNumber} — ${input.storeName}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `BDI Захиалга <${from}>`,
        to: recipients,
        subject,
        text: buildText(input, adminUrl),
        html: buildHtml(input, adminUrl),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[notifications] Resend rejected new-order email (${res.status}): ${body}`,
      );
    }
  } catch (err) {
    console.error("[notifications] new-order email failed:", err);
  }
}
