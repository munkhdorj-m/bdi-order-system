import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/notifications-bell";
import { createClient } from "@/lib/supabase/server";
import { MobileNav } from "./mobile-nav";

type Props = {
  phone: string | null;
  name: string | null;
};

/**
 * Async server header — fetches the current user's notifications inline
 * so the bell has fresh data on every navigation. Capped at 20 latest
 * rows; the full feed lives at /notifications.
 */
export async function AdminHeader({ phone, name }: Props) {
  const supabase = await createClient();
  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const items = (notifs as unknown as NotificationItem[] | null) ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <header className="h-14 border-b flex items-center gap-2 px-4 lg:px-6 bg-background">
      <MobileNav />
      <div className="lg:hidden font-semibold">BDI Admin</div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <div className="text-right hidden sm:block">
          {name && (
            <div className="text-sm font-medium leading-tight">{name}</div>
          )}
          {phone && (
            <div className="text-xs text-muted-foreground leading-tight font-mono">
              {phone}
            </div>
          )}
        </div>
        <NotificationsBell notifications={items} unreadCount={unread} />
        <ThemeToggle variant="admin" />
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" size="icon" title="Гарах">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
