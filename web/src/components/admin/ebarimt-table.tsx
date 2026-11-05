"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Send, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cancelRequest, queueReceipts, requestReturn, type QueueResult } from "@/app/admin/ebarimt/actions";
import { EBARIMT_STATUS_COLOR, EBARIMT_STATUS_LABELS, LIVE_STATUSES, type EbarimtStatus } from "@/lib/ebarimt";
import { formatDateTimeUb } from "@/lib/dispatch";
import { formatMnt } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-method";

export type EbarimtRow = {
  orderId: string;
  orderNumber: string;
  shippedAt: string | null;
  paymentMethod: PaymentMethod | null;
  amount: number;
  storeName: string;
  registry: string | null;
  tin: string | null;
  b2b: boolean;
  shipmentNo: number | null;
  distributor: string | null;
  receipt: {
    id: string;
    status: EbarimtStatus;
    billId: string | null;
    lottery: string | null;
    error: string | null;
    sentAt: string | null;
    attempts: number;
  } | null;
};

const IN_PROGRESS: EbarimtStatus[] = ["queued", "sending", "return_queued", "returning"];

export function EbarimtTable({ rows, sentTotal }: { rows: EbarimtRow[]; sentTotal: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmReturn, setConfirmReturn] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QueueResult | null>(null);

  const sendable = rows.filter((r) => !r.receipt || !LIVE_STATUSES.includes(r.receipt.status));
  const pickedSendable = sendable.filter((r) => picked.has(r.orderId));
  const working = rows.some((r) => r.receipt && IN_PROGRESS.includes(r.receipt.status));

  // While the agent has work in hand, keep the page fresh.
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [working, router]);

  function send(orderIds: string[]) {
    if (orderIds.length === 0) return toast.error("Илгээх захиалга сонгоно уу.");
    start(async () => {
      const r = await queueReceipts(orderIds);
      setLastResult(r);
      if (r.error) toast.error(r.error);
      if (r.queued > 0) toast.success(`${r.queued} баримт дараалалд орлоо`);
      if (r.skipped.length > 0) toast.warning(`${r.skipped.length} захиалга алгаслаа — доор шалтгааныг харна уу`);
      setPicked(new Set());
      router.refresh();
    });
  }

  function act(fn: () => Promise<{ error?: string }>, ok: string) {
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else toast.success(ok);
      setConfirmReturn(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Card className="flex flex-row flex-wrap items-center gap-2 p-3">
        <div className="text-[13px] text-muted-foreground tabular-nums">
          {rows.length} захиалга · илгээсэн дүн <b className="text-foreground">{formatMnt(sentTotal)}</b>
          {working && (
            <span className="ml-2 inline-flex items-center gap-1 text-sky-700 dark:text-sky-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> илгээгдэхийг хүлээж байна
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || pickedSendable.length === 0}
            onClick={() => send(pickedSendable.map((r) => r.orderId))}
          >
            <Send className="h-4 w-4" />
            Сонгосныг илгээх ({pickedSendable.length})
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || sendable.length === 0}
            onClick={() => send(sendable.map((r) => r.orderId))}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Илгээгээгүй бүгдийг ({sendable.length})
          </Button>
        </div>
      </Card>

      {lastResult && (lastResult.skipped.length > 0 || lastResult.warnings.length > 0) && (
        <Card className="space-y-1 p-3 text-[12.5px]">
          {lastResult.skipped.map((s, i) => (
            <div key={`s${i}`} className="text-rose-700 dark:text-rose-300">
              <b>{s.order}</b>: {s.reason}
            </div>
          ))}
          {lastResult.warnings.slice(0, 20).map((w, i) => (
            <div key={`w${i}`} className="text-amber-700 dark:text-amber-300">
              {w}
            </div>
          ))}
          <button type="button" className="text-muted-foreground underline" onClick={() => setLastResult(null)}>
            Хаах
          </button>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Энэ хугацаанд хүргэлтэнд гарсан захиалга алга.
        </Card>
      ) : (
        <Card className="gap-0 overflow-x-auto p-0">
          <table className="w-full text-[12.5px]">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={sendable.length > 0 && pickedSendable.length === sendable.length}
                    onChange={(e) => setPicked(e.target.checked ? new Set(sendable.map((r) => r.orderId)) : new Set())}
                    aria-label="Бүгдийг сонгох"
                  />
                </th>
                <th className="px-2 py-2 text-left font-medium">Захиалга</th>
                <th className="px-2 py-2 text-left font-medium">Худалдан авагч</th>
                <th className="px-2 py-2 text-left font-medium">Төрөл</th>
                <th className="px-2 py-2 text-right font-medium">Дүн</th>
                <th className="px-2 py-2 text-left font-medium">Төлөв</th>
                <th className="px-2 py-2 text-left font-medium">ДДТД</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const status = r.receipt?.status ?? null;
                const canSend = !r.receipt || !LIVE_STATUSES.includes(r.receipt.status);
                return (
                  <tr key={r.orderId} className="align-top">
                    <td className="px-3 py-2">
                      {canSend && (
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked={picked.has(r.orderId)}
                          onChange={(e) =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(r.orderId);
                              else next.delete(r.orderId);
                              return next;
                            })
                          }
                          aria-label={`${r.orderNumber} сонгох`}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Link href={`/admin/orders/${r.orderId}`} className="font-mono font-semibold hover:underline">
                        {r.orderNumber}
                      </Link>
                      <div className="text-[11.5px] text-muted-foreground tabular-nums">
                        {formatDateTimeUb(r.shippedAt)}
                        {r.shipmentNo ? ` · №${r.shipmentNo}` : ""}
                        {r.distributor ? ` · ${r.distributor}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.storeName}</div>
                      <div className="text-[11.5px] text-muted-foreground tabular-nums">
                        {r.registry ? `РД ${r.registry}` : "РД алга"}
                        {r.tin ? ` · ТТД ${r.tin}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[11.5px]">
                      {r.b2b ? "Байгууллага (B2B)" : "Хувь хүн (B2C)"}
                      <div className="text-muted-foreground">
                        {r.paymentMethod ? PAYMENT_METHOD_LABELS[r.paymentMethod] : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatMnt(r.amount)}</td>
                    <td className="px-2 py-2">
                      {status ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${EBARIMT_STATUS_COLOR[status]}`}>
                          {IN_PROGRESS.includes(status) && <Loader2 className="h-3 w-3 animate-spin" />}
                          {EBARIMT_STATUS_LABELS[status]}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-muted-foreground">Илгээгээгүй</span>
                      )}
                      {r.receipt?.error && (
                        <div className="mt-1 max-w-64 break-words text-[11px] text-rose-700 dark:text-rose-300">
                          {r.receipt.error}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px] break-all">
                      {r.receipt?.billId ?? ""}
                      {r.receipt?.sentAt && (
                        <div className="font-sans text-muted-foreground">{formatDateTimeUb(r.receipt.sentAt)}</div>
                      )}
                      {r.receipt?.lottery && <div className="font-sans text-muted-foreground">Сугалаа {r.receipt.lottery}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {canSend && (
                          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => send([r.orderId])}>
                            {status === "failed" || status === "returned" ? (
                              <>
                                <RotateCcw className="h-3.5 w-3.5" /> Дахин илгээх
                              </>
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5" /> Илгээх
                              </>
                            )}
                          </Button>
                        )}
                        {(status === "queued" || status === "return_queued") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              act(
                                () => cancelRequest(r.receipt!.id),
                                status === "queued" ? "Илгээх хүсэлтийг цуцаллаа" : "Буцаах хүсэлтийг цуцаллаа",
                              )
                            }
                          >
                            <X className="h-3.5 w-3.5" /> Цуцлах
                          </Button>
                        )}
                        {status === "sent" &&
                          (confirmReturn === r.receipt!.id ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={busy}
                                onClick={() => act(() => requestReturn(r.receipt!.id), "Буцаах хүсэлт дараалалд орлоо")}
                              >
                                Тийм, буцаах
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReturn(null)}>
                                Болих
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setConfirmReturn(r.receipt!.id)}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Буцаах
                            </Button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
