"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveUser } from "@/app/admin/users/actions";

/**
 * Inline "Approve" button for the admin users list. Visible only on rows
 * where the user is currently pending (active=false). Calls the
 * approveUser server action; on success toasts and refreshes the route
 * so the row's filter state updates.
 */
export function ApproveUserButton({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const r = await approveUser(userId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Хэрэглэгчийг идэвхжүүллээ", { description: userLabel });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
      className="h-8 px-3 rounded-lg text-[11.5px] font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-1.5 shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
      )}
      Зөвшөөрөх
    </button>
  );
}
