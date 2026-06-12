"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/app/notifications/actions";

/**
 * "Mark everything read" for the /notifications feed. The server action
 * existed but was never wired to any UI — unread rows could only be
 * cleared one-by-one by visiting each link.
 */
export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const r = await markAllNotificationsRead();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={run}
      className="gap-1.5"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCheck className="h-3.5 w-3.5" />
      )}
      Бүгдийг уншсан болгох
    </Button>
  );
}
