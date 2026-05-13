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
  // Cancelled is its own outcome — stepper doesn't apply
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

  const currentIdx = statusStepIndex(status);
  const lastIdx = STATUS_STEPS.length - 1;
  const progressPct =
    currentIdx <= 0 ? 0 : (currentIdx / lastIdx) * 100;

  return (
    <div className="relative">
      {/* Connecting track behind the circles */}
      <div className="absolute left-5 right-5 top-5 h-0.5 bg-muted rounded-full" />
      <div
        className="absolute left-5 top-5 h-0.5 bg-primary rounded-full transition-all duration-500"
        style={{ width: `calc((100% - 2.5rem) * ${progressPct / 100})` }}
      />

      <ol className="relative flex items-start justify-between">
        {STATUS_STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isUpcoming = i > currentIdx;
          const Icon = STATUS_ICON[step];
          const ts = formatDateTime(timestamps[step]);

          return (
            <li
              key={step}
              className="flex flex-col items-center text-center min-w-0 flex-1 first:items-start last:items-end"
            >
              <div
                className={cn(
                  "size-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                  isDone &&
                    "bg-primary text-primary-foreground border-primary",
                  isCurrent &&
                    `${STATUS_SOLID[step]} border-transparent shadow-sm ring-4 ring-offset-2 ring-offset-background ring-primary/20 animate-in zoom-in-95`,
                  isUpcoming &&
                    "bg-background border-muted text-muted-foreground/60",
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
                  "mt-2 text-[11px] sm:text-xs font-medium leading-tight w-full px-1",
                  isCurrent && "text-foreground",
                  !isCurrent && "text-muted-foreground",
                )}
              >
                {STATUS_LABELS[step]}
              </div>
              {ts && (
                <div className="mt-0.5 text-[10px] text-muted-foreground/80 leading-tight">
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
