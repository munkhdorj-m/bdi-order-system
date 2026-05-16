"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  base_price: number;
  category_name: string | null;
  custom_price: number | null;
};

type ActionState = { error?: string; ok?: boolean };

type Props = {
  products: ProductRow[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

function formatMnt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
}

export function PriceEditor({ products, action }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const result = await action(prev, fd);
      return result.error ? result : { ok: true };
    },
    {},
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false),
    );
  }, [products, query]);

  return (
    <form action={formAction} className="space-y-4">
      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Барааны нэр, SKU, бренд..."
            className="pl-9"
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Бараа</TableHead>
              <TableHead className="text-right w-32">Жишиг үнэ</TableHead>
              <TableHead className="text-right w-40">Энэ дэлгүүрийн үнэ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.brand ? `${p.brand} · ` : ""}
                    <span className="font-mono">{p.sku}</span>
                    {p.category_name && <> · {p.category_name}</>}
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatMnt(p.base_price)}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    name={`price_${p.id}`}
                    defaultValue={p.custom_price ?? ""}
                    placeholder={String(p.base_price)}
                    className="text-right max-w-32 ml-auto"
                  />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground py-8"
                >
                  Бараа олдсонгүй.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && !pending && (
        <Callout tone="success">✓ Үнийн жагсаалт хадгалагдлаа.</Callout>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Хадгалж байна..." : "Бүх өөрчлөлтийг хадгалах"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Тайлбар: оруулга хоосон үлдэвэл жишиг (бөөний) үнэ ашиглагдана. Өөрөөр
        оруулсан үнэ тухайн дэлгүүрт зөвхөн хүчинтэй.
      </p>
    </form>
  );
}
