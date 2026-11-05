"use client";

import { useState, useTransition } from "react";
import { PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import {
  deactivateSupermarket,
  deleteSupermarket,
} from "@/app/admin/supermarkets/actions";

type Props = {
  id: string;
  name: string;
  active: boolean;
};

export function SupermarketDangerZone({ id, name, active }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"deactivate" | "delete" | null>(null);

  function onDeactivate() {
    startTransition(async () => {
      try {
        await deactivateSupermarket(id);
        toast.success(`«${name}» идэвхгүй боллоо`);
      } catch (err) {
        toast.error((err as Error).message);
      }
      setConfirming(null);
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteSupermarket(id);
      setConfirming(null);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/[0.03] p-4">
      <div className="mb-1 text-sm font-semibold text-destructive">Аюултай үйлдэл</div>
      <p className="mb-3 text-[13px] text-muted-foreground">
        Идэвхгүй болгох нь дэлгүүрийг хадгалж, бүх хэрэглэгчдээс нуудаг.
        Устгах нь буцаагдахгүй — захиалга байгаа дэлгүүрийг устгах боломжгүй.
      </p>
      <div className="flex flex-wrap gap-2">
        {active && (
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirming("deactivate")} disabled={pending}>
            <PowerOff className="h-4 w-4" />
            Идэвхгүй болгох
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirming("delete")}
          disabled={pending}
          className="border-destructive/40 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Бүрмөсөн устгах
        </Button>
      </div>

      <ConfirmDialog
        open={confirming === "deactivate"}
        onOpenChange={(o) => setConfirming(o ? "deactivate" : null)}
        title={`«${name}» дэлгүүрийг идэвхгүй болгох уу?`}
        description="Энэ дэлгүүрийн худалдан авагчид нэвтэрч чадахгүй болно. Дараа нь буцааж идэвхжүүлж болно."
        confirmLabel="Идэвхгүй болгох"
        destructive
        pending={pending}
        onConfirm={onDeactivate}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => setConfirming(o ? "delete" : null)}
        title={`«${name}» дэлгүүрийг бүрмөсөн устгах уу?`}
        description="Буцаах боломжгүй. Захиалгатай дэлгүүрийг устгах боломжгүй."
        confirmLabel="Устгах"
        destructive
        pending={pending}
        onConfirm={onDelete}
      />
    </div>
  );
}
