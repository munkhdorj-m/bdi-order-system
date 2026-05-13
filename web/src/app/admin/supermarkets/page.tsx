import Link from "next/link";
import { ChevronLeft, ChevronRight, DollarSign, Plus, Search, Store as StoreIcon } from "lucide-react";
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
  type: string | null;
  district: string | null;
  address: string | null;
  contact_phone: string | null;
  active: boolean;
  profiles: { full_name: string | null; email: string | null } | null;
};

type SearchParams = Promise<{
  q?: string;
  type?: string;
  district?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

// Common type buckets shown as filter chips. Anything not in this list lands
// in "Бусад" (Other).
const KNOWN_TYPES = [
  "Супермаркет",
  "Сүлжээ",
  "Мини маркет",
  "Хүнсний",
  "Зах",
  "Байгууллага",
  "Бөөний төв",
];

function buildHref(params: {
  q?: string;
  type?: string;
  district?: string;
  page?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type) sp.set("type", params.type);
  if (params.district) sp.set("district", params.district);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/admin/supermarkets?${qs}` : "/admin/supermarkets";
}

export default async function AdminSupermarketsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const typeFilter = sp.type?.trim() || "";
  const districtFilter = sp.district?.trim() || "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from("supermarkets")
    .select(
      "id, name, type, district, address, contact_phone, active, profiles:assigned_rep_id(full_name, email)",
      { count: "exact" },
    )
    .order("name");

  if (q) {
    const term = q.replace(/[%_]/g, "\\$&"); // escape ILIKE wildcards
    query = query.or(
      `name.ilike.%${term}%,address.ilike.%${term}%,contact_phone.ilike.%${term}%`,
    );
  }
  if (typeFilter === "__other") {
    // Anything not in the well-known buckets
    const negated = KNOWN_TYPES.map((t) => `type.not.ilike.%${t}%`).join(",");
    query = query.or(negated);
  } else if (typeFilter) {
    query = query.ilike("type", `%${typeFilter}%`);
  }
  if (districtFilter) {
    query = query.eq("district", districtFilter);
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const [{ data, count, error }, distinctDistricts] = await Promise.all([
    query,
    supabase
      .from("supermarkets")
      .select("district")
      .not("district", "is", null)
      .order("district"),
  ]);

  const rows = (data as unknown as SupermarketRow[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const districts = Array.from(
    new Set(
      ((distinctDistricts.data as { district: string | null }[] | null) ?? [])
        .map((r) => r.district)
        .filter((d): d is string => !!d),
    ),
  );

  return (
    <div className="w-full">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Дэлгүүр</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString("mn-MN")} нийт
            {q || typeFilter || districtFilter ? " (шүүсэн)" : ""}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/admin/supermarkets/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Шинэ дэлгүүр</span>
            <span className="sm:hidden">Шинэ</span>
          </Link>
        </Button>
      </div>

      <Card className="mb-4 p-3 sm:p-4">
        <form className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Нэр, хаяг, утсаар хайх..."
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              name="district"
              defaultValue={districtFilter}
              className="w-full sm:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring truncate"
            >
              <option value="">Бүх дүүрэг</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Хайх
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-3 px-3 sm:-mx-4 sm:px-4 pb-1">
            <TypeChip current={typeFilter} q={q} district={districtFilter} value="">
              Бүгд
            </TypeChip>
            {KNOWN_TYPES.map((t) => (
              <TypeChip
                key={t}
                current={typeFilter}
                q={q}
                district={districtFilter}
                value={t}
              >
                {t}
              </TypeChip>
            ))}
            <TypeChip
              current={typeFilter}
              q={q}
              district={districtFilter}
              value="__other"
            >
              Бусад
            </TypeChip>
          </div>
        </form>
      </Card>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">
          {error.message}
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <StoreIcon className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>Дэлгүүр олдсонгүй.</p>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {rows.map((s) => (
              <div key={s.id} className="bg-background border rounded-lg p-3">
                <Link href={`/admin/supermarkets/${s.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-tight">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        {s.type && <span>{s.type}</span>}
                        {s.district && <span>· {s.district}</span>}
                      </div>
                      {s.address && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {s.address}
                        </div>
                      )}
                    </div>
                    {!s.active && (
                      <Badge variant="outline" className="shrink-0">
                        Идэвхгүй
                      </Badge>
                    )}
                  </div>
                  {(s.contact_phone || s.profiles?.full_name || s.profiles?.email) && (
                    <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {s.contact_phone && (
                        <span className="font-mono">{s.contact_phone}</span>
                      )}
                      {(s.profiles?.full_name || s.profiles?.email) && (
                        <span>
                          Хариуцагч: {s.profiles.full_name ?? s.profiles.email}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
                <div className="mt-2 pt-2 border-t">
                  <Button asChild size="sm" variant="ghost" className="w-full h-8">
                    <Link href={`/admin/supermarkets/${s.id}/prices`}>
                      <DollarSign className="h-3.5 w-3.5" />
                      Үнийн жагсаалт
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">Нэр</TableHead>
                  <TableHead className="w-32">Төрөл</TableHead>
                  <TableHead className="w-40">Дүүрэг</TableHead>
                  <TableHead className="w-36">Утас</TableHead>
                  <TableHead className="hidden xl:table-cell">Хариуцагч</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="align-top">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/supermarkets/${s.id}`}
                            className="font-medium hover:underline block truncate"
                            title={s.name}
                          >
                            {s.name}
                          </Link>
                          {s.address && (
                            <div
                              className="text-xs text-muted-foreground truncate"
                              title={s.address}
                            >
                              {s.address}
                            </div>
                          )}
                        </div>
                        {!s.active && (
                          <Badge variant="outline" className="shrink-0 h-5 text-[10px]">
                            Идэвхгүй
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-foreground truncate"
                      title={s.type ?? undefined}
                    >
                      {s.type ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-foreground truncate"
                      title={s.district ?? undefined}
                    >
                      {s.district ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-xs font-mono truncate"
                      title={s.contact_phone ?? undefined}
                    >
                      {s.contact_phone ?? "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm truncate">
                      {s.profiles?.full_name ?? s.profiles?.email ?? (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        title="Үнийн override"
                      >
                        <Link href={`/admin/supermarkets/${s.id}/prices`}>
                          <DollarSign className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-muted-foreground">
            {offset + 1}–{Math.min(offset + rows.length, total)} / {total.toLocaleString("mn-MN")}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link
                href={buildHref({ q, type: typeFilter, district: districtFilter, page: page - 1 })}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
              >
                <ChevronLeft className="h-4 w-4" />
                Өмнөх
              </Link>
            </Button>
            <span className="px-2 text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
              <Link
                href={buildHref({ q, type: typeFilter, district: districtFilter, page: page + 1 })}
                aria-disabled={page >= totalPages}
                tabIndex={page >= totalPages ? -1 : undefined}
              >
                Дараах
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeChip({
  current,
  value,
  q,
  district,
  children,
}: {
  current: string;
  value: string;
  q: string;
  district: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={buildHref({ q, type: value || undefined, district })}
      className={`whitespace-nowrap shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}
