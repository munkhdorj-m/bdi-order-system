"use client";

import { useTransition } from "react";
import { Trash2, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  function onDeactivate() {
    if (!confirm(`«${name}» дэлгүүрийг идэвхгүй болгох уу? Худалдан авагч нар нэвтэрч чадахгүй болно.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deactivateSupermarket(id);
      } catch (err) {
        alert(`Алдаа: ${(err as Error).message}`);
      }
    });
  }

  function onDelete() {
    if (
      !confirm(
        `«${name}» дэлгүүрийг бүрмөсөн устгах уу?\n\nЭнэ үйлдэл буцаагдашгүй. Захиалга байгаа бол энэ боломжгүй.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteSupermarket(id);
      if (result.error) alert(result.error);
    });
  }

  return (
    <div className="mt-8 border border-destructive/30 rounded-lg p-4 bg-destructive/[0.02]">
      <div className="text-sm font-medium mb-1 text-destructive">Аюултай үйлдэл</div>
      <p className="text-xs text-muted-foreground mb-3">
        Идэвхгүй болгох нь дэлгүүрийг хадгалж, бүх хэрэглэгчдээс нуудаг.
        Устгах нь буцаагдахгүй — захиалга байгаа дэлгүүрийг устгах боломжгүй.
      </p>
      <div className="flex flex-wrap gap-2">
        {active && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDeactivate}
            disabled={pending}
          >
            <PowerOff className="h-4 w-4" />
            Идэвхгүй болгох
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={pending}
          className="text-destructive hover:text-destructive border-destructive/40"
        >
          <Trash2 className="h-4 w-4" />
          Бүрмөсөн устгах
        </Button>
      </div>
    </div>
  );
}
