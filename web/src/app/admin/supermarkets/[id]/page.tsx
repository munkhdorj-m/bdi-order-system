import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardList, DollarSign, Eye, PackagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSupermarketSuggestions } from "@/lib/supermarket-suggestions";
import { Button } from "@/components/ui/button";
import { SupermarketForm } from "@/components/admin/supermarket-form";
import { SupermarketDangerZone } from "@/components/admin/supermarket-danger-zone";
import { updateSupermarket } from "../actions";

type Params = Promise<{ id: string }>;

export default async function EditSupermarketPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: supermarket },
    { data: reps },
    { data: priceLists },
    suggestions,
  ] = await Promise.all([
    supabase
      .from("supermarkets")
      .select(
        "id, name, type, district, address, contact_phone, assigned_rep_id, price_list_id, delivery_day, notes, active, registry_number, ebarimt_tin, ebarimt_name, external_id",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("role", "rep")
      .order("full_name"),
    supabase
      .from("price_lists")
      .select("id, name, active")
      .order("name"),
    getSupermarketSuggestions(),
  ]);

  if (!supermarket) notFound();

  // Active lists, plus an archived one this store still uses — otherwise
  // the picker showed "— Жишиг үнэ —" while the store paid list prices.
  const listOptions = ((priceLists ?? []) as { id: string; name: string; active: boolean }[])
    .filter((pl) => pl.active || pl.id === supermarket.price_list_id)
    .map((pl) => ({ id: pl.id, name: pl.name, archived: !pl.active }));

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

      <h1 className="mb-4 text-2xl font-semibold tracking-tight min-w-0 truncate">
        {supermarket.name}
      </h1>

      {/* Everything you do for this store, one tap away. */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/admin/orders/new?store=${id}`}>
            <PackagePlus className="h-4 w-4" />
            Захиалга оруулах
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/orders?store=${id}`}>
            <ClipboardList className="h-4 w-4" />
            Захиалгууд
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/supermarkets/${id}/catalog`} title="Энэ дэлгүүрт харагдах каталог">
            <Eye className="h-4 w-4" />
            Каталог харах
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/supermarkets/${id}/prices`}>
            <DollarSign className="h-4 w-4" />
            Тусгай үнэ
          </Link>
        </Button>
      </div>

      <SupermarketForm
        reps={reps ?? []}
        priceLists={listOptions}
        defaults={supermarket}
        typeSuggestions={suggestions.types}
        districtSuggestions={suggestions.districts}
        action={update}
        submitLabel="Хадгалах"
      />

      <SupermarketDangerZone
        id={supermarket.id}
        name={supermarket.name}
        active={supermarket.active}
      />
    </div>
  );
}
