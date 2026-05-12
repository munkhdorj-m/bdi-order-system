import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceListMetaForm } from "@/components/admin/price-list-meta-form";
import { AutoAssignForm } from "@/components/admin/auto-assign-form";
import { PriceEditor } from "@/components/admin/price-editor";
import {
  autoAssignByKeyword,
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

  const [{ data: list }, { data: products }, { data: items }, { data: stores }] =
    await Promise.all([
      supabase
        .from("price_lists")
        .select("id, name, description, active")
        .eq("id", id)
        .single(),
      supabase
        .from("products")
        .select("id, sku, name, brand, base_price, categories(name)")
        .eq("active", true)
        .order("name"),
      supabase
        .from("price_list_items")
        .select("product_id, price")
        .eq("price_list_id", id),
      supabase
        .from("supermarkets")
        .select("id, name, district, active")
        .eq("price_list_id", id)
        .order("name"),
    ]);

  if (!list) notFound();

  const priceMap = new Map<string, number>();
  ((items as PriceListItem[] | null) ?? []).forEach((it) =>
    priceMap.set(it.product_id, it.price),
  );

  const rows = ((products as unknown as ProductFromDb[]) ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    base_price: p.base_price,
    category_name: p.categories?.name ?? null,
    custom_price: priceMap.get(p.id) ?? null,
  }));

  const assignedStores = (stores as AssignedStore[] | null) ?? [];

  const updateMeta = updatePriceList.bind(null, id);
  const autoAssign = autoAssignByKeyword.bind(null, id);
  const saveItems = savePriceListItems.bind(null, id);

  async function handleDelete() {
    "use server";
    await deletePriceList(id);
  }

  async function handleUnassign(formData: FormData) {
    "use server";
    const storeId = String(formData.get("store_id") ?? "");
    if (!storeId) return;
    await unassignStore(storeId, `/admin/price-lists/${id}`);
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
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Устгах</span>
            </Button>
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
              Тохирох нэр/хаягтай бүх дэлгүүрт энэ жагсаалтыг нэг товчоор оноох.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AutoAssignForm action={autoAssign} />
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
                      className="text-muted-foreground hover:text-destructive"
                      title="Энэ дэлгүүрээс хасах"
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
            Хоосон үлдээвэл жишиг (бөөний) үнэ ашиглагдана. Энэ дэлгүүр-онцлогт
            тохирох override <em>customer_prices</em> хүснэгтэд хадгалагдсан хэвээр.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriceEditor products={rows} action={saveItems} />
        </CardContent>
      </Card>
    </div>
  );
}
