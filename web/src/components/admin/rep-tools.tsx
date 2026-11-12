"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignAllStores,
  assignStoresByMercuryManager,
  linkDistributor,
  unassignRepStores,
} from "@/app/admin/users/rep-actions";

export type RepDistributor = { id: string; name: string; phone: string | null; linkedTo: string | null };

const NONE = "__none__";

type Confirming = "all" | "clear" | null;

/**
 * What a sales rep needs before working from the website: their stores
 * (in bulk — by who looks after them in Mercury) and, for the delivery
 * person, the link to their Түгээгч so they see their runs on the phone.
 */
export function RepTools({
  userId,
  assignedCount,
  managers,
  distributors,
  setupHint,
}: {
  userId: string;
  assignedCount: number;
  /** Mercury's "Менежер" values with how many customers each has. */
  managers: { name: string; customers: number }[];
  distributors: RepDistributor[];
  /** Shown instead of the delivery link while fix 43 hasn't been run. */
  setupHint: string | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  // Nothing preselected: the biggest group is usually the office's own, not this rep's.
  const [manager, setManager] = useState("");
  const [onlyFree, setOnlyFree] = useState(true);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const linked = distributors.find((d) => d.linkedTo === userId)?.id ?? NONE;
  const [distributor, setDistributor] = useState(linked);

  function run(task: () => Promise<{ error?: string; count?: number }>, ok: (count: number) => string) {
    start(async () => {
      const r = await task();
      setConfirming(null);
      if (r.error) toast.error(r.error);
      if (!r.error || (r.count ?? 0) > 0) toast.success(ok(r.count ?? 0));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Store className="h-4 w-4 text-muted-foreground" />
            Хариуцах дэлгүүр
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <p className="text-muted-foreground">
            Төлөөлөгч зөвхөн өөрт оноогдсон дэлгүүрийг харж, захиалга авна. Одоо{" "}
            <b className="text-foreground tabular-nums">{assignedCount}</b> дэлгүүр оноогдсон.
          </p>

          {managers.length > 0 ? (
            <div className="rounded-xl bg-muted/40 p-3 ring-1 ring-border">
              <div className="mb-2 text-[12.5px] font-semibold">Mercury дээрх менежерээр нь оноох</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-64 max-w-full">
                  <Select value={manager} onValueChange={setManager}>
                    <SelectTrigger size="default" className="h-10 w-full rounded-xl" aria-label="Mercury менежер">
                      <SelectValue placeholder="Менежер сонгох" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name} · {m.customers} харилцагч
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  disabled={busy || !manager}
                  onClick={() =>
                    run(
                      () => assignStoresByMercuryManager(userId, manager, onlyFree),
                      (n) => `${n} дэлгүүр оноогдлоо`,
                    )
                  }
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Оноох
                </Button>
              </div>
              <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={onlyFree}
                  onChange={(e) => setOnlyFree(e.target.checked)}
                />
                Зөвхөн төлөөлөгчгүй дэлгүүрт (өөр төлөөлөгчтэйг хөндөхгүй)
              </label>
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Mercury-н хуулбар алга тул менежерээр оноох боломжгүй. Дэлгүүр бүрийн хуудаснаас төлөөлөгчийг сонгож болно.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirming("all")}>
              Бүх идэвхтэй дэлгүүрийг оноох
            </Button>
            {assignedCount > 0 && (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirming("clear")}>
                Оноолтыг бүгдийг цуцлах
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Хүргэлт хийдэг үү?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          {setupHint ? (
            <p className="text-muted-foreground">{setupHint}</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                Энэ хүн түгээгч бол доороос сонгоно. Тэгвэл утсан дээрээ өөрийн ачилтын захиалгуудыг харж, хүргэсэн тоогоо
                засаж, «Хүргэсэн» гэж тэмдэглэнэ.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-64 max-w-full">
                  <Select value={distributor} onValueChange={setDistributor}>
                    <SelectTrigger size="default" className="h-10 w-full rounded-xl" aria-label="Түгээгч">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Үгүй — түгээгч биш</SelectItem>
                      {distributors.map((d) => (
                        <SelectItem key={d.id} value={d.id} disabled={!!d.linkedTo && d.linkedTo !== userId}>
                          {d.name}
                          {d.phone ? ` ${d.phone}` : ""}
                          {d.linkedTo && d.linkedTo !== userId ? " (өөр хэрэглэгчтэй)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  disabled={busy || distributor === linked}
                  onClick={() =>
                    run(
                      () => linkDistributor(userId, distributor === NONE ? null : distributor),
                      () => (distributor === NONE ? "Түгээгчийн холбоос салгагдлаа" : "Түгээгчтэй холбогдлоо"),
                    )
                  }
                >
                  Хадгалах
                </Button>
              </div>
              {distributors.length === 0 && (
                <p className="text-[12.5px] text-muted-foreground">
                  Түгээгч бүртгэгдээгүй байна. «Хүргэлт хуваарлах» хуудсанд ачилт үүсгэхдээ түгээгчээ нэмнэ.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming === "all"}
        onOpenChange={(o) => setConfirming(o ? "all" : null)}
        title="Бүх идэвхтэй дэлгүүрийг энэ төлөөлөгчид оноох уу?"
        description={
          onlyFree
            ? "Төлөөлөгчгүй бүх идэвхтэй дэлгүүр оноогдоно. Өөр төлөөлөгчтэй дэлгүүр хэвээр үлдэнэ."
            : "Өөр төлөөлөгчтэй дэлгүүрүүд ч энэ хүнд шилжинэ."
        }
        confirmLabel="Тийм, оноох"
        pending={busy}
        onConfirm={() => run(() => assignAllStores(userId, onlyFree), (n) => `${n} дэлгүүр оноогдлоо`)}
      />
      <ConfirmDialog
        open={confirming === "clear"}
        onOpenChange={(o) => setConfirming(o ? "clear" : null)}
        title={`${assignedCount} дэлгүүрийн оноолтыг цуцлах уу?`}
        description="Дэлгүүрүүд төлөөлөгчгүй болно. Захиалга, үнэ хэвээр."
        confirmLabel="Тийм, цуцлах"
        destructive
        pending={busy}
        onConfirm={() => run(() => unassignRepStores(userId), (n) => `${n} дэлгүүрийн оноолт цуцлагдлаа`)}
      />
    </div>
  );
}
