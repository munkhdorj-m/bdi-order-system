import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { count: productCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });
  const { count: supermarketCount } = await supabase
    .from("supermarkets")
    .select("*", { count: "exact", head: true });
  const { count: orderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  const stats = [
    { label: "Бараа", value: productCount ?? 0 },
    { label: "Дэлгүүр", value: supermarketCount ?? 0 },
    { label: "Захиалга", value: orderCount ?? 0 },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Дашбоард</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Тавтай морил</CardTitle>
          <CardDescription>
            Phase 2 — бараа, дэлгүүр, үнэ удирдах хэсэг бүтэгдэж байна.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Зүүн талын цэснээс хүссэн хэсгээ сонгоно уу. Эхэлж <strong>Бараа</strong> хэсгээр орох
            эсвэл импорт хийх бол доорх удирдамжийг үзнэ үү.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
