import { Check } from "lucide-react";
import { type OrderStatus } from "@/lib/order-status";

type Timestamps = {
  pending: string;
  confirmed: string | null;
  shipped: string | null;
  delivered: string | null;
  cancelled?: string | null;
};

type Step = {
  key: "pending" | "confirmed" | "shipped" | "delivered";
  label: string;
  at: string | null;
};

function formatShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Vertical timeline of an order's lifecycle. Per the Hi-Fi design: 4 steps,
 * each row a circle + connecting line + label/timestamp. Done steps fill
 * primary, the current step glows amber with a pulse, and pending steps
 * stay muted.
 *
 * Cancelled orders short-circuit and show only the "Үүсгэгдсэн" + "Цуцалсан"
 * pair so we don't pretend a cancelled order is still moving forward.
 */
export function OrderTimeline({
  status,
  timestamps,
}: {
  status: OrderStatus;
  timestamps: Timestamps;
}) {
  if (status === "cancelled") {
    const rows: Array<{ label: string; at: string | null; tone: "done" | "cancelled" }> = [
      { label: "Үүсгэгдсэн", at: timestamps.pending, tone: "done" },
      {
        label: "Цуцалсан",
        at: timestamps.cancelled ?? null,
        tone: "cancelled",
      },
    ];
    return <TimelineList rows={rows} />;
  }

  const steps: Step[] = [
    { key: "pending", label: "Үүсгэгдсэн", at: timestamps.pending },
    { key: "confirmed", label: "Баталгаажсан", at: timestamps.confirmed },
    { key: "shipped", label: "Илгээсэн", at: timestamps.shipped },
    { key: "delivered", label: "Хүргэгдсэн", at: timestamps.delivered },
  ];

  const currentIdx = steps.findIndex((s) => s.key === status);

  const rows = steps.map((s, i) => ({
    label: s.label,
    at: s.at,
    tone:
      i < currentIdx
        ? ("done" as const)
        : i === currentIdx
          ? ("current" as const)
          : ("pending" as const),
  }));

  return <TimelineList rows={rows} />;
}

type Tone = "done" | "current" | "pending" | "cancelled";

function TimelineList({
  rows,
}: {
  rows: Array<{ label: string; at: string | null; tone: Tone }>;
}) {
  return (
    <div className="flex flex-col">
      {rows.map((row, i) => {
        const last = i === rows.length - 1;
        return (
          <div key={i} className="flex gap-3 items-start relative">
            <div className="flex flex-col items-center">
              <TimelineDot tone={row.tone} />
              {!last && (
                <div
                  className="w-0.5 h-6"
                  style={{
                    background:
                      row.tone === "done"
                        ? "var(--primary)"
                        : "var(--border)",
                  }}
                />
              )}
            </div>
            <div className="flex-1 pb-2">
              <div
                className={`text-[13px] font-semibold ${
                  row.tone === "pending" ? "text-muted-foreground" : ""
                }`}
              >
                {row.label}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {formatShort(row.at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineDot({ tone }: { tone: Tone }) {
  if (tone === "done") {
    return (
      <div className="size-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
        <Check className="h-3 w-3" strokeWidth={3} />
      </div>
    );
  }
  if (tone === "current") {
    return (
      <div className="size-6 rounded-full flex items-center justify-center bg-amber-100 ring-2 ring-amber-400 text-amber-900 dark:bg-amber-950/60 dark:ring-amber-700">
        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
      </div>
    );
  }
  if (tone === "cancelled") {
    return (
      <div className="size-6 rounded-full flex items-center justify-center bg-rose-100 ring-2 ring-rose-400 text-rose-900 dark:bg-rose-950/60 dark:ring-rose-700">
        <span className="size-1.5 rounded-full bg-rose-500" />
      </div>
    );
  }
  return (
    <div className="size-6 rounded-full flex items-center justify-center bg-muted ring-1 ring-border text-muted-foreground">
      <span className="size-1 rounded-full bg-muted-foreground/40" />
    </div>
  );
}
