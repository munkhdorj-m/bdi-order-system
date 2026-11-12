import Link from "next/link";
import { ChevronRight, PackageCheck, Truck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { loadMyRuns, myDistributor, type MyRun } from "@/lib/delivery-runs";
import { RepHeader } from "@/components/rep/rep-header";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import { formatDayLabel } from "@/lib/datetime";
import { formatMnt } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-method";

/**
 * Хүргэлт — the delivery person's runs on the phone: what Mercury's app
 * showed the Түгээгч. Each order opens to hand over, adjust and mark
 * delivered. Only for a login linked to a Түгээгч (/admin/users).
 */
export default async function DeliveryPage() {
  const session = await requireSession();
  const { distributor, setup } = await myDistributor(session.userId);

  if (!distributor) {
    return (
      <div className="min-h-screen bg-background">
        <RepHeader title="Хүргэлт" backHref="/rep" />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-[15px] font-semibold">
            {setup ? "Хүргэлтийн дэлгэц хараахан идэвхжээгүй байна" : "Танд хүргэлт оноогдоогүй байна"}
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {setup
              ? "Оффис тохиргоогоо дуусгамагц энд таны ачилтууд гарна."
              : "Та түгээгч бол оффист хэлж бүртгэлээ түгээгчтэй холбуулна уу."}
          </p>
        </div>
      </div>
    );
  }

  const runs = await loadMyRuns(distributor.id);

  return (
    <div className="min-h-screen bg-background">
      <RepHeader title="Хүргэлт" subtitle={distributor.name} backHref="/rep" />
      <main className="mx-auto w-full max-w-2xl px-3 pb-10 pt-3 sm:px-4">
        {runs.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-[15px] font-semibold">Одоогоор ачилт алга</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Оффис ачилтаа хаамагц хүргэх захиалгууд энд гарна.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RunCard({ run }: { run: MyRun }) {
  const out = run.status === "closed";
  const delivered = run.orders.filter((o) => o.status === "delivered").length;
  const left = run.orders.filter((o) => o.status === "shipped").length;
  const cashAll = run.orders.filter((o) => o.payment_method === "cash");
  const cashTotal = cashAll.reduce((s, o) => s + o.amount, 0);
  const cashGot = cashAll.filter((o) => o.status === "delivered").reduce((s, o) => s + o.amount, 0);
  // Still to hand over first, then what's done.
  const orders = [...run.orders].sort((a, b) => Number(a.status === "delivered") - Number(b.status === "delivered"));

  return (
    <section aria-label={`Ачилт №${run.shipment_no}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
        <h2 className="font-display text-[16px] font-semibold">Ачилт №{run.shipment_no}</h2>
        <span className="text-[12.5px] text-muted-foreground">{formatDayLabel(run.delivery_date)}</span>
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
            !out
              ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
              : left === 0
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
          }`}
        >
          {!out ? "Оффис бэлтгэж байна" : left === 0 ? "Дууссан" : `${left} үлдсэн`}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-border">
          <div className="font-display text-[18px] font-semibold tabular-nums leading-tight">
            {delivered}/{run.orders.length}
          </div>
          <div className="text-[12px] text-muted-foreground">хүргэсэн</div>
        </div>
        <div className="rounded-xl bg-card px-3 py-2 ring-1 ring-border">
          <div className="font-display text-[18px] font-semibold tabular-nums leading-tight">
            {formatMnt(cashGot)}
            <span className="text-[12px] font-normal text-muted-foreground"> / {formatMnt(cashTotal)}</span>
          </div>
          <div className="text-[12px] text-muted-foreground">бэлнээр авах</div>
        </div>
      </div>

      {run.orders.length === 0 ? (
        <div className="rounded-xl bg-card p-6 text-center text-[13px] text-muted-foreground ring-1 ring-border">
          Энэ ачилтад захиалга алга.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-border divide-y divide-border">
          {orders.map((o) => {
            const done = o.status === "delivered";
            return (
              <li key={o.id}>
                <Link
                  href={`/rep/delivery/${o.id}`}
                  className={`flex min-h-16 items-center gap-3 px-3 py-2.5 active:bg-accent/60 ${done ? "opacity-70" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[14px] font-semibold leading-snug">{o.store.name}</span>
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <PackageCheck className="h-3.5 w-3.5" />
                          Хүргэсэн
                        </span>
                      ) : (
                        !out && <OrderStatusPill status={o.status} />
                      )}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {[o.store.district, o.store.address].filter(Boolean).join(" · ") || "Хаяг бүртгэгдээгүй"}
                    </div>
                    <div className="text-[12px] text-muted-foreground tabular-nums">
                      {o.pieces}ш{o.payment_method ? ` · ${PAYMENT_METHOD_LABELS[o.payment_method]}` : ""}
                      {o.notes ? " · тэмдэглэлтэй" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[14px] font-bold tabular-nums">{formatMnt(o.amount)}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
