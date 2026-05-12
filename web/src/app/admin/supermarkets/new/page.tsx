import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSupermarketSuggestions } from "@/lib/supermarket-suggestions";
import { SupermarketForm } from "@/components/admin/supermarket-form";
import { createSupermarket } from "../actions";

export default async function NewSupermarketPage() {
  const supabase = await createClient();
  const [{ data: reps }, suggestions] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "rep")
      .order("full_name"),
    getSupermarketSuggestions(),
  ]);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/supermarkets"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Дэлгүүр жагсаалт руу
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Шинэ дэлгүүр</h1>
      <SupermarketForm
        reps={reps ?? []}
        typeSuggestions={suggestions.types}
        districtSuggestions={suggestions.districts}
        action={createSupermarket}
        submitLabel="Үүсгэх"
      />
    </div>
  );
}
