import { Check, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_ICON,
  STATUS_LABELS,
  STATUS_SOLID,
  STATUS_STEPS,
  statusStepIndex,
  type OrderStatus,
} from "@/lib/order-status";

type Props = {
  status: OrderStatus;
  /** Map of step → ISO timestamp to annotate completed steps. */
  timestamps?: Partial<Record<OrderStatus, string | null>>;
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderProgress({ status, timestamps = {} }: Props) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 p-4">
        <div className="size-9 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
          <XCircle className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-rose-700 dark:text-rose-200">
            Цуцлагдсан
          </div>
          <div className="text-xs text-muted-foreground">
            Энэ захиалга цуцлагдсан.
          </div>
        </div>
      </div>
    );
  }

  const stepCount = STATUS_STEPS.length;
  const lastIdx = stepCount - 1;
  const currentIdx = Math.max(0, statusStepIndex(status));

  // Each step occupies an equal-width column (flex-1). With items-center on
  // every column, circle centres sit at (2i+1)/(2N) of the container width.
  // The connecting line therefore must inset by 1/(2N) on each side so it
  // runs exactly between the first and last circle centres.
  const trackInset = `${(100 / (2 * stepCount)).toFixed(4)}%`;
  const progressPct =
    lastIdx === 0 ? 0 : (currentIdx / lastIdx) * 100;

  return (
    <div className="relative">
      {/* Gray track between first & last circle centres */}
      <div
        className="absolute top-5 h-0.5 bg-muted rounded-full -translate-y-1/2"
        style={{ left: trackInset, right: trackInset }}
      />
      {/* Primary fill on top */}
      <div
        className="absolute top-5 h-0.5 bg-primary rounded-full transition-[width] duration-500 -translate-y-1/2"
        style={{
          left: trackInset,
          width: `calc((100% - 2 * ${trackInset}) * ${progressPct} / 100)`,
        }}
      />

      <ol className="relative flex items-start">
        {STATUS_STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const Icon = STATUS_ICON[step];
          const ts = formatDateTime(timestamps[step]);

          return (
            <li
              key={step}
              className="flex flex-col items-center text-center min-w-0 flex-1 px-1"
            >
              <div
                className={cn(
                  "size-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors bg-background",
                  isDone &&
                    "bg-primary text-primary-foreground border-primary",
                  isCurrent &&
                    `${STATUS_SOLID[step]} border-transparent shadow-sm ring-4 ring-offset-2 ring-offset-background ring-primary/20`,
                  !isDone && !isCurrent &&
                    "border-muted text-muted-foreground/60",
                )}
              >
                {isDone ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "mt-2 text-[11px] sm:text-xs font-medium leading-tight",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {STATUS_LABELS[step]}
              </div>
              {ts && (
                <div className="mt-0.5 text-[10px] text-muted-foreground/80 leading-tight tabular-nums">
                  {ts}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
