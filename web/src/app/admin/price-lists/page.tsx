import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export default async function PriceListsPage() {
  const supabase = await createClient();
  const [{ data: lists }, { data: itemCounts }, { data: storeCounts }] =
    await Promise.all([
      supabase
        .from("price_lists")
        .select("id, name, description, active")
        .order("name"),
      supabase.from("price_list_items").select("price_list_id"),
      supabase
        .from("supermarkets")
        .select("price_list_id")
        .not("price_list_id", "is", null),
    ]);

  const rows = (lists as Row[] | null) ?? [];

  const itemsPer = new Map<string, number>();
  ((itemCounts as { price_list_id: string }[] | null) ?? []).forEach((r) =>
    itemsPer.set(r.price_list_id, (itemsPer.get(r.price_list_id) ?? 0) + 1),
  );
  const storesPer = new Map<string, number>();
  ((storeCounts as { price_list_id: string }[] | null) ?? []).forEach((r) =>
    storesPer.set(r.price_list_id, (storesPer.get(r.price_list_id) ?? 0) + 1),
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Үнийн жагсаалт</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Олон дэлгүүрт нийтлэг ашиглах үнийн загвар. ({rows.length})
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/admin/price-lists/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Шинэ жагсаалт</span>
            <span className="sm:hidden">Шинэ</span>
          </Link>
        </Button>
      </div>

      <Card className="mb-4 p-4 bg-muted/40 text-sm">
        <p className="font-medium mb-1">Хэрхэн ашиглах:</p>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Шинэ жагсаалт үүсгэх (жишээ нь: <em>Nomin</em>)</li>
          <li>Хэрэгтэй бараа бүрт үнэ оруулах</li>
          <li>Тухайн дэлгүүрүүдэд оноох — нэгийг нэгээр нь, эсвэл түлхүүр үгээр бөөнөөр</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-2">
          Үнийн дараалал: тус дэлгүүрийн override → жагсаалт → жишиг үнэ
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>Жагсаалт алга байна.</p>
          <p className="text-sm mt-1">
            <Link href="/admin/price-lists/new" className="text-primary hover:underline">
              Эхний жагсаалтыг үүсгэх
            </Link>
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {rows.map((l) => (
              <Link
                key={l.id}
                href={`/admin/price-lists/${l.id}`}
                className="block bg-background border rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{l.name}</div>
                    {l.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {l.description}
                      </div>
                    )}
                  </div>
                  {!l.active && <Badge variant="outline" className="shrink-0">Идэвхгүй</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>{itemsPer.get(l.id) ?? 0} бараа</span>
                  <span>{storesPer.get(l.id) ?? 0} дэлгүүр</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Нэр</TableHead>
                  <TableHead className="text-right">Бараа</TableHead>
                  <TableHead className="text-right">Дэлгүүр</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/admin/price-lists/${l.id}`}
                        className="font-medium hover:underline"
                      >
                        {l.name}
                      </Link>
                      {l.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {l.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {itemsPer.get(l.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {storesPer.get(l.id) ?? 0}
                    </TableCell>
                    <TableCell>
                      {!l.active && <Badge variant="outline">Идэвхгүй</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
