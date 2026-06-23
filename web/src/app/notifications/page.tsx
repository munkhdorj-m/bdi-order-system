import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import type { NotificationItem } from "@/components/notifications-bell";

const KIND_LABELS: Record<NotificationItem["kind"], string> = {
  order_new: "Захиалга",
  order_status: "Захиалгын төлөв",
  user_approved: "Бүртгэл",
  discount_new: "Хямдрал",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Full notification feed — open from the bell dropdown's "Бүгдийг харах"
 * link. Lists everything in reverse-chronological order; RLS scopes it
 * to the current user. Available to all signed-in roles.
 */
export default async function NotificationsPage() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = (data as unknown as NotificationItem[] | null) ?? [];

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight mb-1">
            Мэдэгдэл
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Сүүлийн 200 мэдэгдэл
            {unreadCount > 0 && (
              <span className="font-semibold text-primary">
                {" "}
                · {unreadCount} шинэ
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>Мэдэгдэл алга байна.</p>
        </Card>
      ) : (
        <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-border overflow-hidden">
          {items.map((n) => {
            const Body = n.href ? Link : "div";
            return (
              <li key={n.id}>
                <Body
                  href={n.href ?? "#"}
                  className={`block px-4 py-3 hover:bg-muted/40 transition-colors ${
                    !n.read_at ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                      {KIND_LABELS[n.kind]}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  <div className="text-[13.5px] font-semibold mt-0.5">
                    {n.title}
                  </div>
                  {n.body && (
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {n.body}
                    </div>
                  )}
                </Body>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
