import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import { Card } from "@/components/ui/card";
import {
  CategoryManager,
  type ManagedCategory,
} from "@/components/admin/category-manager";

/**
 * Product categories — the sections stores see in the catalog, in this
 * order, each with its own picture and colour.
 */
export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const [cats, { data: products }, { data: deals }] = await Promise.all([
    getCategories(),
    supabase.from("products").select("id, name, image_url, active, category_id").order("name"),
    supabase.from("discounts").select("category_id").not("category_id", "is", null),
  ]);

  const rows = (products ?? []) as {
    id: string;
    name: string;
    image_url: string | null;
    active: boolean;
    category_id: string | null;
  }[];
  const dealCount = new Map<string, number>();
  for (const d of deals ?? []) {
    const id = d.category_id as string;
    dealCount.set(id, (dealCount.get(id) ?? 0) + 1);
  }

  const managed: ManagedCategory[] = cats.map((c) => {
    const items = rows.filter((p) => p.category_id === c.id);
    return {
      id: c.id,
      name: c.name,
      icon: c.icon,
      visible: items.filter((p) => p.active).length,
      hidden: items.filter((p) => !p.active).length,
      deals: dealCount.get(c.id) ?? 0,
      photos: items
        .filter((p) => p.active && p.image_url)
        .slice(0, 4)
        .map((p) => ({ src: p.image_url as string, alt: p.name })),
    };
  });
  const uncategorized = rows.filter((p) => !p.category_id);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Ангилал</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Дэлгүүрийн каталогт бараа эдгээр бүлгээр, энэ дарааллаар харагдана. Зураг дээр дарж ангиллын дүрсийг солино.
        Идэвхтэй бараагүй ангилал дэлгүүрт харагдахгүй.
      </p>

      {uncategorized.length > 0 && (
        <Card className="mb-4 flex flex-row items-center gap-3 border-amber-300 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm">
            <b>{uncategorized.length}</b> бараа ангилалгүй байна — дэлгүүрт «Бусад» хэсэгт харагдана.
          </p>
          <Link
            href="/admin/products?category=none"
            className="shrink-0 text-sm font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300"
          >
            Ангилал оноох
          </Link>
        </Card>
      )}

      <CategoryManager categories={managed} />
    </div>
  );
}
