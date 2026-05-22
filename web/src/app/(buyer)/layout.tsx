import { redirect } from "next/navigation";
import { requireSession, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BuyerShell } from "@/components/buyer/shell";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/notifications-bell";
import { DiscountsChip } from "@/components/buyer/discounts-chip";
import type { DiscountCard } from "@/components/buyer/discount-hero";
import type { DiscountRule } from "@/lib/discount";

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  if (
    session.profile.role !== "buyer" ||
    !session.profile.supermarket_id
  ) {
    redirect(homePathForRole(session.profile));
  }

  const supabase = await createClient();
  const [{ data: store }, { data: notifs }, { data: discountRows }] =
    await Promise.all([
      supabase
        .from("supermarkets")
        .select("name")
        .eq("id", session.profile.supermarket_id)
        .single(),
      supabase
        .from("notifications")
        .select("id, kind, title, body, href, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      // RLS scopes to active + in-window rules. The chip needs both
      // kinds (product + threshold_bonus) since it shows them in
      // separate sections inside the drawer.
      supabase
        .from("discounts")
        .select(
          "id, name, kind, pct, step_amount, step_qty, bonus_n, product_id, category_id, ends_at, products:product_id(name), categories:category_id(name)",
        ),
    ]);

  const items = (notifs as unknown as NotificationItem[] | null) ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  // Shape the raw rules into DiscountCard rows for the chip. We strip
  // legacy `bulk` / `bonus` kinds so the drawer only ever shows the
  // current two-kind world.
  const rawRules =
    (discountRows as unknown as Array<
      DiscountRule & {
        products: { name: string } | null;
        categories: { name: string } | null;
      }
    > | null) ?? [];
  const dealCards: DiscountCard[] = rawRules
    .filter((r) => r.kind === "product" || r.kind === "threshold_bonus")
    .map((r) => ({
      rule: {
        id: r.id,
        name: r.name,
        kind: r.kind,
        pct: r.pct,
        step_amount: r.step_amount,
        step_qty: r.step_qty,
        bonus_n: r.bonus_n,
        product_id: r.product_id,
        category_id: r.category_id,
        ends_at: r.ends_at,
      },
      productName: r.products?.name ?? null,
      categoryName: r.categories?.name ?? null,
    }));

  return (
    <BuyerShell
      storeName={store?.name ?? ""}
      email={session.email}
      bell={<NotificationsBell notifications={items} unreadCount={unread} />}
      dealsChip={
        <DiscountsChip cards={dealCards} count={dealCards.length} />
      }
    >
      {children}
    </BuyerShell>
  );
}
