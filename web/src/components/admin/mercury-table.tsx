"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MercuryRow = {
  key: string;
  date?: string | null;
  /** Gone from Mercury's latest list (deleted there); our copy is kept. */
  missing?: boolean;
  data: Record<string, unknown>;
};

/** Rendering thousands of 20-column rows at once makes typing in the filter lag. */
const RENDER_CAP = 300;

/**
 * Read-only table of mirrored Mercury rows. Columns are whatever Mercury
 * showed; every row also expands to its full JSON (prices, link ids, …).
 * With `filterable`, a search box matches text anywhere in the row — used
 * for full lists (products, customers) that arrive in one piece.
 */
export function MercuryTable({
  rows,
  columns,
  filterable,
}: {
  rows: MercuryRow[];
  columns: string[];
  filterable: boolean;
}) {
  const [q, setQ] = useState("");

  // Lower-cased once, so each keystroke is a plain substring scan.
  const haystacks = useMemo(
    () => rows.map((r) => `${r.key} ${JSON.stringify(r.data)}`.toLowerCase()),
    [rows],
  );

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((_, i) => haystacks[i].includes(needle));
  }, [q, rows, haystacks]);

  const shown = matches.slice(0, RENDER_CAP);
  const showDate = rows.some((r) => r.date);

  return (
    <div className="space-y-3">
      {filterable && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative sm:max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Хайх: нэр, код, утас, РД…"
              className="pl-9"
            />
          </div>
          <div className="text-[12.5px] text-muted-foreground tabular-nums">
            {matches.length.toLocaleString("en-US")} / {rows.length.toLocaleString("en-US")}
            {matches.length > RENDER_CAP && ` · эхний ${RENDER_CAP}-г харуулж байна`}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card ring-1 ring-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Mercury ID</TableHead>
              {showDate && <TableHead className="whitespace-nowrap">Огноо</TableHead>}
              {columns.map((c) => (
                <TableHead key={c} className="whitespace-nowrap">
                  {c}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 3} className="text-center text-muted-foreground py-10">
                  Илэрц алга.
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => (
                <TableRow key={r.key} className={r.missing ? "opacity-60" : undefined}>
                  <TableCell className="font-mono text-[11.5px] whitespace-nowrap">
                    {r.key}
                    {r.missing && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Mercury-д алга
                      </Badge>
                    )}
                  </TableCell>
                  {showDate && <TableCell className="whitespace-nowrap tabular-nums">{r.date ?? ""}</TableCell>}
                  {columns.map((c) => (
                    <TableCell key={c} className="max-w-[18rem] truncate" title={String(r.data[c] ?? "")}>
                      {String(r.data[c] ?? "")}
                    </TableCell>
                  ))}
                  <TableCell className="align-top">
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                        JSON
                      </summary>
                      <pre className="mt-2 max-w-[32rem] max-h-80 overflow-auto rounded-lg bg-muted/60 p-2 text-[10.5px] leading-relaxed">
                        {JSON.stringify(r.data, null, 2)}
                      </pre>
                    </details>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
