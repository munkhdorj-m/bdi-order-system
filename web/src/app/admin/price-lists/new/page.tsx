import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceListMetaForm } from "@/components/admin/price-list-meta-form";
import { createPriceList } from "../actions";

export default function NewPriceListPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/price-lists"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Үнийн жагсаалт руу
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Шинэ жагсаалт</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Үнийг үүсгэхийн өмнө эхлээд нэр оруулна уу. Үнэ + дэлгүүр оноох үе шат
        дараагийн дэлгэц дээр.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Жагсаалтын тохиргоо</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceListMetaForm action={createPriceList} submitLabel="Үүсгэх" />
        </CardContent>
      </Card>
    </div>
  );
}
