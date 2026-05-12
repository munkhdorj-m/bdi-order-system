import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSupermarketSuggestions } from "@/lib/supermarket-suggestions";
import { Button } from "@/components/ui/button";
import { SupermarketForm } from "@/components/admin/supermarket-form";
import { updateSupermarket } from "../actions";

type Params = Promise<{ id: string }>;

export default async function EditSupermarketPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: supermarket }, { data: reps }, suggestions] = await Promise.all([
    supabase
      .from("supermarkets")
      .select(
        "id, name, type, district, address, contact_phone, assigned_rep_id, notes, active",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "rep")
      .order("full_name"),
    getSupermarketSuggestions(),
  ]);

  if (!supermarket) notFound();

  const update = updateSupermarket.bind(null, id);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/supermarkets"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Дэлгүүр жагсаалт руу
      </Link>

      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-semibold tracking-tight min-w-0 truncate">
          {supermarket.name}
        </h1>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={`/admin/supermarkets/${id}/prices`}>
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Үнийн жагсаалт</span>
          </Link>
        </Button>
      </div>

      <SupermarketForm
        reps={reps ?? []}
        defaults={supermarket}
        typeSuggestions={suggestions.types}
        districtSuggestions={suggestions.districts}
        action={update}
        submitLabel="Хадгалах"
      />
    </div>
  );
}
