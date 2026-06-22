import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { fetchAllStores } from "@/lib/stores";
import { UserForm } from "@/components/admin/user-form";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { updateUser } from "../actions";

type Params = Promise<{ id: string }>;

export default async function EditUserPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await getSession();

  // fetchAllStores pages past the server row cap so every store (active +
  // inactive) reaches the picker, not just the first 1000 by name.
  const [{ data: user }, supermarkets] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, phone, full_name, role, supermarket_id, active")
      .eq("id", id)
      .single(),
    fetchAllStores(),
  ]);

  if (!user) notFound();

  const isSelf = session?.userId === id;
  const update = updateUser.bind(null, id);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/users"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Хэрэглэгч жагсаалт руу
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        {user.full_name || user.phone || user.id.slice(0, 8)}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {isSelf ? "Энэ та өөрөө байна." : "Энэ хэрэглэгчийн эрх, дэлгүүрийг тохируулна."}
      </p>

      <UserForm
        defaults={user}
        supermarkets={supermarkets}
        action={update}
        isSelf={isSelf}
      />

      {/* Danger zone — hidden when viewing your own profile because
          the action refuses self-delete anyway, and we don't want to
          dangle a destructive button you can't use. */}
      {!isSelf && (
        <div className="mt-10 pt-6 border-t">
          <div className="mb-3">
            <h2 className="text-[13px] uppercase tracking-[0.08em] font-bold text-destructive">
              Аюултай бүс
            </h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              Энэ хэрэглэгчийг бүрэн устгана. Захиалга үүсгэсэн
              хэрэглэгчийг устгах боломжгүй — оронд нь идэвхгүй болгоно
              уу.
            </p>
          </div>
          <DeleteUserButton
            userId={user.id}
            displayName={user.full_name || user.phone || user.id.slice(0, 8)}
          />
        </div>
      )}
    </div>
  );
}
