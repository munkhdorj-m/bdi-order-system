import { redirect } from "next/navigation";
import { requireSession, homePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BuyerShell } from "@/components/buyer/shell";

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
  const { data: store } = await supabase
    .from("supermarkets")
    .select("name")
    .eq("id", session.profile.supermarket_id)
    .single();

  return (
    <BuyerShell storeName={store?.name ?? ""} email={session.email}>
      {children}
    </BuyerShell>
  );
}
