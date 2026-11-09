"use client";

import { LogOut } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";

/**
 * The header's sign-out icon (store and rep apps). It sits among other
 * 40px icons, and signing back in takes the phone + password, so it asks
 * first instead of logging out on a stray tap.
 */
export function SignOutButton({ title, className }: { title?: string; className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <ConfirmSubmitButton
        title="Системээс гарах уу?"
        description={
          title
            ? `${title} дугаараар дахин нэвтрэхэд нууц үгээ оруулна.`
            : "Дахин нэвтрэхэд утасны дугаар, нууц үгээ оруулна."
        }
        confirmLabel="Гарах"
        destructive={false}
        variant="ghost"
        size="icon"
        aria-label="Гарах"
        className={cn("rounded-xl", className)}
      >
        <LogOut className="h-[18px] w-[18px]" />
      </ConfirmSubmitButton>
    </form>
  );
}
