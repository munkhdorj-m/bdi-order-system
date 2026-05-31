import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  UserCreateForm,
  type SupermarketOption,
} from "@/components/admin/user-create-form";

/**
 * Admin route for creating a new user account on someone's behalf.
 * Pulls the supermarket list so the form can offer one when the role
 * is "buyer". Server-renders so the supermarket list is always fresh
 * (no client fetch needed).
 */
export default async function AdminCreateUserPage() {
  const supabase = await createClient();
  const { data: stores } = await supabase
    .from("supermarkets")
    .select("id, name, address")
    .eq("active", true)
    .order("name");

  const supermarkets: SupermarketOption[] = (stores ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    address: (s.address as string | null) ?? null,
  }));

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/users"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Хэрэглэгч жагсаалт руу
      </Link>

      <div className="mb-5">
        <h1 className="text-[26px] font-bold tracking-tight">Шинэ хэрэглэгч</h1>
        <p className="text-[13px] text-muted-foreground">
          Та хэрэглэгчийн өмнөөс бүртгэл үүсгэж байна. Үүсгэсний дараа
          хэрэглэгч өөрийн нууц үгээрээ шууд нэвтрэх боломжтой.
        </p>
      </div>

      <UserCreateForm supermarkets={supermarkets} />
    </div>
  );
}
