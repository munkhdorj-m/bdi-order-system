import Link from "next/link";
import { Bell, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { homePathForRole, requireSession, type UserRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import { PushToggle } from "@/components/push-toggle";
import { NotificationLink, type NotificationItem } from "@/components/notifications-bell";

const KIND_LABELS: Record<NotificationItem["kind"], string> = {
  order_new: "Захиалга",
  order_status: "Захиалгын төлөв",
  order_cancelled: "Цуцлагдсан",
  user_approved: "Бүртгэл",
  user_pending: "Шинэ хэрэглэгч",
  discount_new: "Хямдрал",
};

/** What a push brings, per role — the office, a store, a rep. */
const PUSH_HINT: Record<UserRole, string> = {
  admin: "Шинэ захиалга, шинэ бүртгэл орж ирэхэд энэ төхөөрөмж дээр шууд мэдэгдэл ирнэ.",
  buyer: "Захиалга тань баталгаажих, хүргэлтэнд гарах, хүргэгдэхэд энэ утсанд шууд мэдэгдэл ирнэ.",
  rep: "Таны оруулсан захиалгын төлөв өөрчлөгдөхөд энэ утсанд шууд мэдэгдэл ирнэ.",
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
  const session = await requireSession();
  // This page sits outside the store / rep / admin frames, so it brings
  // its own bar with a way home — an installed app has no browser Back.
  const home = homePathForRole(session.profile);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = (data as unknown as NotificationItem[] | null) ?? [];

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="on-brand sticky top-0 z-10 flex h-14 items-center gap-2.5 bg-brand-bar px-2 text-brand-bar-foreground sm:px-4">
        <Link
          href={home}
          aria-label="Буцах"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-sans text-[15px] font-semibold text-white">Мэдэгдэл</h1>
      </header>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
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

        {/* Per-device push opt-in, explained in terms of what THIS person
            gets: the office hears of new orders and sign-ups; a store or a
            rep hears when their orders move along. */}
        <div className="mb-4 rounded-2xl bg-card ring-1 ring-border p-4">
          <div className="text-[14px] font-semibold mb-1">
            Утсандаа мэдэгдэл авах
          </div>
          <p className="text-[13px] text-muted-foreground mb-3">
            {PUSH_HINT[session.profile.role]} Төхөөрөмж бүр дээр тусад нь асаана.
          </p>
          <PushToggle />
        </div>

        {items.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>Мэдэгдэл алга байна.</p>
          </Card>
        ) : (
          <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-border overflow-hidden">
            {items.map((n) => {
              const rowClass = `block px-4 py-3 hover:bg-muted/40 transition-colors ${
                !n.read_at ? "bg-primary/5" : ""
              }`;
              const content = (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-muted-foreground">
                      {KIND_LABELS[n.kind]}
                    </span>
                    {!n.read_at && (
                      <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
                        Шинэ
                      </span>
                    )}
                    <span className="text-[12px] text-muted-foreground ml-auto tabular-nums">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  <div className="text-[14px] font-semibold mt-0.5">{n.title}</div>
                  {n.body && (
                    <div className="text-[13px] text-muted-foreground mt-0.5">{n.body}</div>
                  )}
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <NotificationLink id={n.id} href={n.href} unread={!n.read_at} className={rowClass}>
                      {content}
                    </NotificationLink>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
