"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions";

export type NotificationItem = {
  id: string;
  kind: "order_new" | "order_status" | "user_approved" | "discount_new";
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "одоо";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  return `${d} өдөр`;
}

const KIND_DOT: Record<NotificationItem["kind"], string> = {
  order_new: "bg-primary",
  order_status: "bg-sky-500",
  user_approved: "bg-emerald-500",
  discount_new: "bg-violet-500",
};

/**
 * Header bell button + dropdown notification feed. Rendered in
 * BuyerHeader + AdminHeader. The parent server component fetches the
 * 20 most recent notifications and the unread count, so this client
 * piece only owns popover state + click → router.refresh.
 */
export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(n: NotificationItem) {
    startTransition(async () => {
      if (!n.read_at) await markNotificationRead(n.id);
      if (n.href) {
        setOpen(false);
        router.push(n.href);
      } else {
        router.refresh();
      }
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Мэдэгдэл"
          className="relative size-9 rounded-full hover:bg-muted active:scale-95 transition-all flex items-center justify-center text-foreground/70"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9.5px] font-bold tabular-nums flex items-center justify-center ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[20rem] sm:w-[22rem] p-0 max-h-[70vh] overflow-hidden flex flex-col"
      >
        <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2">
          <div className="text-[13px] font-bold">Мэдэгдэл</div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={pending}
              className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Бүгдийг уншсан
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-[12.5px] text-muted-foreground">
              Мэдэгдэл алга байна.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const isUnread = !n.read_at;
                const Wrapper = n.href ? "button" : "div";
                return (
                  <li key={n.id}>
                    <Wrapper
                      type={n.href ? "button" : undefined}
                      onClick={n.href ? () => handleClick(n) : undefined}
                      className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-muted/50 transition-colors ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      <span
                        className={`mt-1.5 size-1.5 rounded-full shrink-0 ${isUnread ? KIND_DOT[n.kind] : "bg-muted-foreground/40"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold line-clamp-2">
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="text-[11.5px] text-muted-foreground mt-0.5 line-clamp-2">
                            {n.body}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/80 mt-1 tabular-nums">
                          {relativeTime(n.created_at)} өмнө
                        </div>
                      </div>
                    </Wrapper>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Link
          href="/notifications"
          className="block px-3 py-2 border-t text-center text-[12px] text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          Бүгдийг харах
        </Link>
      </PopoverContent>
    </Popover>
  );
}
