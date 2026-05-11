import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: "admin" | "rep" | "buyer";
  active: boolean;
  supermarkets: { name: string } | null;
};

const ROLE_LABELS: Record<UserRow["role"], string> = {
  admin: "Админ",
  rep: "Төлөөлөгч",
  buyer: "Худалдан авагч",
};

const ROLE_VARIANT: Record<UserRow["role"], "default" | "secondary" | "outline"> = {
  admin: "default",
  rep: "secondary",
  buyer: "outline",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, role, active, supermarkets:supermarket_id(name)",
    )
    .order("role")
    .order("created_at", { ascending: false });

  const rows = (data as unknown as UserRow[]) ?? [];

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Хэрэглэгчид</h1>
        <p className="text-sm text-muted-foreground mt-1">Нийт {rows.length}</p>
      </div>

      <Card className="mb-6 p-4 bg-muted/40 text-sm">
        <p className="font-medium mb-1">Шинэ хэрэглэгч нэмэхдээ:</p>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>
            Тэр хүн <span className="font-mono">/login</span> -ээр өөрийн имэйлээ
            ашиглан нэвтэрнэ.
          </li>
          <li>Эхэлж <em>Худалдан авагч</em> (хүлээгдэх) төлөвөөр бүртгэгдэнэ.</li>
          <li>Та эндээс түүний эрхийг, шаардлагатай бол дэлгүүрийг сонгож хадгална.</li>
        </ol>
      </Card>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      <Card>
        {rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>Хэрэглэгч алга байна.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Нэр</TableHead>
                <TableHead>Эрх</TableHead>
                <TableHead>Дэлгүүр</TableHead>
                <TableHead>Холбоо</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-medium hover:underline"
                    >
                      {u.full_name || u.email || u.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[u.role]}>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.role === "buyer" ? (
                      u.supermarkets?.name ?? (
                        <span className="text-muted-foreground italic">
                          Тогтоогоогүй
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.email ? (
                      <span className="font-mono text-xs">{u.email}</span>
                    ) : null}
                    {u.phone && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {u.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {!u.active && <Badge variant="outline">Идэвхгүй</Badge>}
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
