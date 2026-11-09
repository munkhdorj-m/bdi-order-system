import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm";
import { PriceListMetaForm } from "@/components/admin/price-list-meta-form";
import { AutoAssignForm } from "@/components/admin/auto-assign-form";
import { PriceEditor } from "@/components/admin/price-editor";
import {
  deletePriceList,
  savePriceListItems,
  unassignStore,
  updatePriceList,
} from "../actions";

type Params = Promise<{ id: string }>;

type ProductFromDb = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  base_price: number;
  categories: { name: string } | null;
};

type PriceListItem = { product_id: string; price: number };

type AssignedStore = {
  id: string;
  name: string;
  district: string | null;
  active: boolean;
};

export default async function PriceListDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Every row: a list can hold more than 1,000 stores, and a product list
  // grows past one page too.
  const [{ data: list }, products, items, assignedStores] = await Promise.all([
    supabase
      .from("price_lists")
      .select("id, name, description, active")
      .eq("id", id)
      .single(),
    fetchAll<ProductFromDb>(() =>
      supabase
        .from("products")
        .select("id, sku, name, brand, base_price, categories(name)")
        .eq("active", true)
        .order("name")
        .order("id"),
    ),
    fetchAll<PriceListItem>(() =>
      supabase.from("price_list_items").select("product_id, price").eq("price_list_id", id).order("product_id"),
    ),
    fetchAll<AssignedStore>(() =>
      supabase
        .from("supermarkets")
        .select("id, name, district, active")
        .eq("price_list_id", id)
        .order("name")
        .order("id"),
    ),
  ]);

  if (!list) notFound();

  const priceMap = new Map<string, number>();
  items.forEach((it) => priceMap.set(it.product_id, it.price));

  const rows = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    ref_price: Number(p.base_price) || 0,
    category_name: p.categories?.name ?? null,
    custom_price: priceMap.get(p.id) ?? null,
  }));

  const updateMeta = updatePriceList.bind(null, id);
  const saveItems = savePriceListItems.bind(null, id);

  async function handleDelete() {
    "use server";
    await deletePriceList(id);
  }

  async function handleUnassign(formData: FormData) {
    "use server";
    const storeId = String(formData.get("store_id") ?? "");
    if (!storeId) return;
    await unassignStore(storeId, id);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link
          href="/admin/price-lists"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Үнийн жагсаалт руу
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {list.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {priceMap.size} бараа · {assignedStores.length} дэлгүүр
            </p>
          </div>
          <form action={handleDelete}>
            <ConfirmSubmitButton
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive shrink-0"
              title={`«${list.name}» жагсаалтыг устгах уу?`}
              description={
                assignedStores.length > 0
                  ? `${assignedStores.length} дэлгүүр үндсэн үнэ рүү шилжинэ. Буцаах боломжгүй.`
                  : "Буцаах боломжгүй."
              }
              confirmLabel="Устгах"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Устгах</span>
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Тохиргоо</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceListMetaForm
              defaults={list}
              action={updateMeta}
              submitLabel="Хадгалах"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Бөөнөөр оноох</CardTitle>
            <CardDescription>
              Нэрээр нь дэлгүүрүүдийг хайж, жагсаалтаа шалгаад энэ үнийн жагсаалтыг оноо.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AutoAssignForm priceListId={id} listName={list.name} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Оноогдсон дэлгүүрүүд ({assignedStores.length})
          </CardTitle>
          <CardDescription>
            Эдгээр дэлгүүрүүд энэ жагсаалтын үнийг автоматаар ашиглана.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedStores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Оноогдсон дэлгүүр алга. Бөөнөөр оноох эсвэл дэлгүүрийн хуудаснаас
              нэг бүрчлэн сонгоно уу.
            </p>
          ) : (
            <ul className="divide-y -my-2">
              {assignedStores.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/supermarkets/${s.id}`}
                      className="text-sm hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.district && (
                      <div className="text-xs text-muted-foreground">
                        {s.district}
                      </div>
                    )}
                  </div>
                  <form action={handleUnassign}>
                    <input type="hidden" name="store_id" value={s.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="size-10 text-muted-foreground hover:text-destructive"
                      title="Энэ жагсаалтаас хасах"
                      aria-label={`${s.name} — жагсаалтаас хасах`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Үнэ</CardTitle>
          <CardDescription>
            Хоосон үлдээвэл жишиг (бөөний) үнэ ашиглагдана. Дэлгүүрийн хуудсанд
            оруулсан тусгай үнэ энэ жагсаалтаас давуу эрхтэй хэвээр.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriceEditor
            products={rows}
            action={saveItems}
            priceLabel="Жагсаалтын үнэ"
            note="Хоосон үлдээвэл жишиг (бөөний) үнэ ашиглагдана. Энэ үнэ жагсаалтад оноогдсон бүх дэлгүүрт хүчинтэй."
            savedLabel="✓ Үнийн жагсаалт хадгалагдлаа."
          />
        </CardContent>
      </Card>
    </div>
  );
}
