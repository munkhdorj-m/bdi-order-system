import Link from "next/link";
import { DollarSign, Plus, Store as StoreIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SupermarketRow = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  active: boolean;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function AdminSupermarketsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supermarkets")
    .select(
      "id, name, address, contact_phone, active, profiles:assigned_rep_id(full_name, email)",
    )
    .order("created_at", { ascending: false });

  const rows = (data as unknown as SupermarketRow[]) ?? [];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Дэлгүүр</h1>
          <p className="text-sm text-muted-foreground mt-1">Нийт {rows.length}</p>
        </div>
        <Button asChild>
          <Link href="/admin/supermarkets/new">
            <Plus className="h-4 w-4" />
            Шинэ дэлгүүр
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      <Card>
        {rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <StoreIcon className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>Дэлгүүр алга байна.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Нэр</TableHead>
                <TableHead>Утас</TableHead>
                <TableHead>Хариуцагч</TableHead>
                <TableHead></TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/admin/supermarkets/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.address && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {s.address}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{s.contact_phone ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {s.profiles?.full_name ?? s.profiles?.email ?? (
                      <span className="text-muted-foreground italic">
                        Хариуцагчгүй
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge variant="secondary">Идэвхтэй</Badge>
                    ) : (
                      <Badge variant="outline">Идэвхгүй</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/supermarkets/${s.id}/prices`}>
                        <DollarSign className="h-4 w-4" />
                        Үнэ
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
