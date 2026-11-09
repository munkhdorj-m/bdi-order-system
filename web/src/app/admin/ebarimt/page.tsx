import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EbarimtTable, type EbarimtRow } from "@/components/admin/ebarimt-table";
import { addDays, formatDateTimeUb, isIsoDay, minutesSince, todayUb, ubDayStart } from "@/lib/dispatch";
import { cleanRegistry, LIVE_STATUSES, type EbarimtStatus } from "@/lib/ebarimt";
import type { PaymentMethod } from "@/lib/payment-method";

type SearchParams = Promise<{ from?: string; to?: string; show?: string }>;

const SHOW = ["all", "unsent", "sent", "failed", "returned"] as const;
type Show = (typeof SHOW)[number];
const SHOW_LABELS: Record<Show, string> = {
  all: "Бүгд",
  unsent: "Илгээгээгүй",
  sent: "Илгээсэн",
  failed: "Алдаатай",
  returned: "Буцаасан",
};

type OrderRow = {
  id: string;
  order_number: string;
  shipped_at: string | null;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount_total: number | null;
  store: { name: string; registry_number: string | null; ebarimt_tin: string | null; ebarimt_name: string | null } | null;
  shipment: { shipment_no: number; distributor: { name: string } | null } | null;
};

type ReceiptRow = {
  id: string;
  order_id: string;
  status: EbarimtStatus;
  receipt_type: string;
  bill_id: string | null;
  lottery: string | null;
  error: string | null;
  total_amount: number;
  queued_at: string;
  sent_at: string | null;
  returned_at: string | null;
};

type AgentStatus = {
  last_seen_at: string | null;
  posapi_ok: boolean | null;
  info: Record<string, unknown> | null;
  error: string | null;
};

function AgentBanner({ agent }: { agent: AgentStatus | null }) {
  if (!agent?.last_seen_at) {
    return (
      <Card className="block mb-4 border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <b>Е-баримт илгээх компьютер холбогдоогүй байна.</b> Баримтыг дараалалд оруулж болно, гэхдээ PosAPI 3.0
        суусан компьютер дээр <code>ebarimt-agent</code> ажиллаж эхэлмэгц илгээгдэнэ. Заавар:{" "}
        <code>docs/ebarimt-setup.md</code>.
      </Card>
    );
  }
  const online = minutesSince(agent.last_seen_at) < 2;
  const ok = online && agent.posapi_ok;
  const info = agent.info ?? {};
  return (
    <Card
      className={`block mb-4 p-4 text-[13px] ${
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
      }`}
    >
      <b>
        {ok
          ? "Е-баримт компьютер онлайн"
          : online
            ? "PosAPI холбогдохгүй байна"
            : "Е-баримт компьютер офлайн"}
      </b>{" "}
      · сүүлд {formatDateTimeUb(agent.last_seen_at)}
      {typeof info.lastSentDate === "string" && ` · МТА-д сүүлд илгээсэн ${info.lastSentDate}`}
      {typeof info.leftLotteries === "number" && ` · үлдсэн сугалаа ${info.leftLotteries}`}
      {agent.error && <div className="mt-1 break-words opacity-90">{agent.error}</div>}
    </Card>
  );
}

/**
 * Е-баримт — Mercury's "НӨАТУС V3" page: every shipped order in a date
 * range with its e-Barimt state; send, re-send or return (Буцаах).
 */
export default async function EbarimtPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayUb();
  const to = isIsoDay(sp.to) ? sp.to : today;
  const from = isIsoDay(sp.from) ? sp.from : addDays(today, -1);
  const show: Show = SHOW.includes(sp.show as Show) ? (sp.show as Show) : "all";
  const supabase = await createClient();

  // Every shipped order in the range — a single request stopped at 1,000.
  const [ordersRes, agentRes] = await Promise.all([
    fetchAll<OrderRow>(() =>
      supabase
        .from("orders")
        .select(
          "id, order_number, shipped_at, payment_method, subtotal, discount_total, store:supermarket_id(name, registry_number, ebarimt_tin, ebarimt_name), shipment:shipment_id(shipment_no, distributor:distributor_id(name))",
        )
        .in("status", ["shipped", "delivered"])
        .gte("shipped_at", ubDayStart(from))
        .lt("shipped_at", ubDayStart(addDays(to, 1)))
        .order("shipped_at", { ascending: false })
        .order("id"),
    )
      .then((data) => ({ data, error: null as { message: string } | null }))
      .catch((e: Error) => ({ data: [] as OrderRow[], error: { message: e.message } })),
    supabase.from("ebarimt_agent_status").select("last_seen_at, posapi_ok, info, error").eq("id", "main").maybeSingle(),
  ]);

  let setupError: { message: string } | null = ordersRes.error ?? agentRes.error;
  const orders = ordersRes.data;

  // Receipts for those orders, a few requests side by side. A failed read
  // must not show sent receipts as "not sent".
  const receipts: ReceiptRow[] = [];
  if (!setupError && orders.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < orders.length; i += 150) chunks.push(orders.slice(i, i + 150).map((o) => o.id));
    const parts = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("ebarimt_receipts")
          .select("id, order_id, status, receipt_type, bill_id, lottery, error, total_amount, queued_at, sent_at, returned_at")
          .in("order_id", ids)
          .order("queued_at", { ascending: false }),
      ),
    );
    const failed = parts.find((p) => p.error);
    if (failed?.error) setupError = { message: failed.error.message };
    for (const p of parts) receipts.push(...((p.data ?? []) as ReceiptRow[]));
    // Newest first across chunks, so "latest per order" below is right.
    receipts.sort((a, b) => (a.queued_at < b.queued_at ? 1 : a.queued_at > b.queued_at ? -1 : 0));
  }
  // Newest receipt per order decides its state; older ones are history.
  const latest = new Map<string, ReceiptRow>();
  const attempts = new Map<string, number>();
  for (const r of receipts) {
    if (!latest.has(r.order_id)) latest.set(r.order_id, r);
    attempts.set(r.order_id, (attempts.get(r.order_id) ?? 0) + 1);
  }

  const rows: EbarimtRow[] = orders.map((o) => {
    const r = latest.get(o.id) ?? null;
    const registry = o.store?.registry_number ?? null;
    return {
      orderId: o.id,
      orderNumber: o.order_number,
      shippedAt: o.shipped_at,
      paymentMethod: o.payment_method,
      amount: Math.max(0, Number(o.subtotal) - Number(o.discount_total ?? 0)),
      storeName: o.store?.name ?? "—",
      registry,
      tin: o.store?.ebarimt_tin ?? null,
      b2b: Boolean(cleanRegistry(registry || o.store?.ebarimt_tin)),
      shipmentNo: o.shipment?.shipment_no ?? null,
      distributor: o.shipment?.distributor?.name ?? null,
      receipt: r
        ? {
            id: r.id,
            status: r.status,
            billId: r.bill_id,
            lottery: r.lottery,
            error: r.error,
            sentAt: r.sent_at,
            attempts: attempts.get(o.id) ?? 1,
          }
        : null,
    };
  });

  const isLive = (row: EbarimtRow) => !!row.receipt && LIVE_STATUSES.includes(row.receipt.status);
  const filtered = rows.filter((row) => {
    switch (show) {
      case "unsent":
        return !isLive(row);
      case "sent":
        return row.receipt?.status === "sent";
      case "failed":
        return row.receipt?.status === "failed";
      case "returned":
        return row.receipt?.status === "returned";
      default:
        return true;
    }
  });
  const sentTotal = rows.filter((r) => r.receipt?.status === "sent").reduce((s, r) => s + r.amount, 0);
  const agent = (agentRes.data as AgentStatus | null) ?? null;
  // The table only polls while the e-Barimt computer is there to answer.
  const agentOnline = !!agent?.last_seen_at && minutesSince(agent.last_seen_at) < 2;

  const link = (next: Partial<{ from: string; to: string; show: Show }>) => {
    const q = new URLSearchParams({ from: next.from ?? from, to: next.to ?? to, show: next.show ?? show });
    return `/admin/ebarimt?${q}`;
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-4">
        <h1 className="text-[26px] font-bold tracking-tight">Е-баримт</h1>
        <p className="text-[13px] text-muted-foreground">
          Хүргэлтэнд гарсан захиалгын НӨАТ-ын баримтыг е-баримт системд (PosAPI 3.0) илгээх, буцаах.
        </p>
      </div>

      {!setupError && <AgentBanner agent={agent} />}

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-[12px] text-muted-foreground">
            Эхлэх
            <input type="date" name="from" defaultValue={from} className="field mt-1 block h-9 w-40" />
          </label>
          <label className="text-[12px] text-muted-foreground">
            Дуусах
            <input type="date" name="to" defaultValue={to} className="field mt-1 block h-9 w-40" />
          </label>
          <input type="hidden" name="show" value={show} />
          <Button type="submit" size="sm" className="h-9">
            Хайх
          </Button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {SHOW.map((s) => (
              <Link key={s} href={link({ show: s })} className="chip h-9 px-3" data-active={s === show || undefined}>
                {SHOW_LABELS[s]}
              </Link>
            ))}
          </div>
        </form>
      </Card>

      {setupError ? (
        <Card className="p-6 text-sm">
          <div className="font-medium mb-1">Е-баримтын мэдээллийг уншиж чадсангүй.</div>
          {/relation|does not exist|schema cache/i.test(setupError.message) && (
            <p className="text-muted-foreground">
              Supabase SQL Editor дээр <code>docs/fixes/37-dispatch-and-ebarimt.sql</code>-ийг ажиллуулна уу.
            </p>
          )}
          <p className="text-muted-foreground mt-2 break-words">Алдаа: {setupError.message}</p>
        </Card>
      ) : (
        <EbarimtTable rows={filtered} sentTotal={sentTotal} agentOnline={agentOnline} />
      )}
    </div>
  );
}
