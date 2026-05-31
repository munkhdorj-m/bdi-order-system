"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteUser } from "@/app/admin/users/actions";

/**
 * Danger-zone delete control for the user edit page.
 *
 * Inline two-step confirm pattern (no dialog library): clicking "Устгах"
 * once reveals a confirm panel with the user's display name typed
 * naturally into the warning text. A second click on "Тийм, устга"
 * fires the delete server action.
 *
 * `displayName` is purely for the confirmation message; deletion is by
 * `userId`. After a successful delete we router.push back to the user
 * list so the now-stale [id] page can't be re-rendered against a
 * deleted row.
 */
export function DeleteUserButton({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function fire() {
    startTransition(async () => {
      const r = await deleteUser(userId);
      if (r.error) {
        toast.error(r.error);
        setConfirming(false);
        return;
      }
      toast.success("Хэрэглэгчийг устгалаа", { description: displayName });
      router.push("/admin/users");
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="h-4 w-4" />
        Хэрэглэгч устгах
      </Button>
    );
  }

  return (
    <div className="rounded-2xl bg-destructive/10 ring-1 ring-destructive/30 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold text-destructive">
            Та "{displayName}" хэрэглэгчийг устгахдаа итгэлтэй байна уу?
          </div>
          <div className="text-[12px] text-destructive/85 mt-1 leading-relaxed">
            Энэ үйлдлийг буцаах боломжгүй. Хэрэглэгчийн бүртгэл болон
            холбоотой бүх профайл устгагдана. Хэрэв энэ хэрэглэгч захиалга
            үүсгэсэн бол устгал хоригдоно — тэр тохиолдолд бүртгэлийг
            идэвхгүй болгож (Цуцлах) ашиглах нь зөв.
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant="destructive"
          onClick={fire}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Устгаж байна...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              Тийм, устга
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Цуцлах
        </Button>
      </div>
    </div>
  );
}
