"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMnt } from "@/lib/format";
import { checkDayansoft, type DayansoftCheck } from "@/app/admin/shipments/dayansoft-actions";

const ACCOUNT_KEY = "bdi-dayansoft-account";

// The account code the accountant gave, remembered on this computer.
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function savedAccount(): string {
  try {
    return window.localStorage.getItem(ACCOUNT_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * The sales file for the accounting system (Dayansoft ERP), for a range of
 * delivery days: check what it will hold, then download it. Replaces
 * Dayansoft's own pull from Mercury once Mercury is off.
 */
export function DayansoftExport({ from, to }: { from: string; to: string }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ from, to });
  const remembered = useSyncExternalStore(subscribe, savedAccount, () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const account = typed ?? remembered;
  const [partner, setPartner] = useState<"registry" | "mercury">("registry");
  const [item, setItem] = useState<"internal" | "barcode">("internal");
  const [check, setCheck] = useState<DayansoftCheck | null>(null);
  const [busy, start] = useTransition();

  function setAccount(v: string) {
    setTyped(v);
    setCheck(null);
    try {
      window.localStorage.setItem(ACCOUNT_KEY, v);
      listeners.forEach((fn) => fn());
    } catch {
      // private mode: it just isn't remembered
    }
  }

  const params = new URLSearchParams({ format: "dayansoft", dfrom: range.from, dto: range.to, partner, item });
  if (account.trim()) params.set("account", account.trim());
  const href = `/admin/export?${params}`;

  function runCheck() {
    start(async () => {
      const r = await checkDayansoft({ from: range.from, to: range.to, account, partnerCode: partner, itemCode: item });
      if (r.error) toast.error(r.error);
      setCheck(r.error ? null : r);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" />
        Санхүүд өгөх файл (Dayansoft)
      </Button>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-bold">Санхүүд өгөх борлуулалтын файл (Dayansoft)</div>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            Сонгосон хүргэлтийн өдрүүдэд гарсан (хүргэлтэнд гарсан, хүргэгдсэн) захиалгуудыг Dayansoft-н
            борлуулалтын багц импортын загвараар (SalesBatch) гаргана. Анх удаа нягтлантай хамт нэг өдрийн
            файлаар туршиж, код таарч байгааг шалгана.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Хаах
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-[12px] text-muted-foreground">
          Хүргэсэн өдөр — эхлэх
          <input
            type="date"
            value={range.from}
            onChange={(e) => {
              setRange((r) => ({ ...r, from: e.target.value }));
              setCheck(null);
            }}
            className="field mt-1 block h-9 w-full"
          />
        </label>
        <label className="text-[12px] text-muted-foreground">
          дуусах
          <input
            type="date"
            value={range.to}
            onChange={(e) => {
              setRange((r) => ({ ...r, to: e.target.value }));
              setCheck(null);
            }}
            className="field mt-1 block h-9 w-full"
          />
        </label>
        <label className="text-[12px] text-muted-foreground">
          Бараа данс (нягтлангаас)
          <Input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="Жишээ: 150101"
            maxLength={40}
            className="mt-1 h-9"
          />
        </label>
        <div className="text-[12px] text-muted-foreground">
          Харилцагчийн код
          <Select
            value={partner}
            onValueChange={(v) => {
              setPartner(v as "registry" | "mercury");
              setCheck(null);
            }}
          >
            <SelectTrigger size="default" className="mt-1 h-9 w-full rounded-xl" aria-label="Харилцагчийн код">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="registry">Регистрийн дугаар (РД)</SelectItem>
              <SelectItem value="mercury">Mercury-н бүртгэлийн дугаар</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-[12px] text-muted-foreground">
          Барааны код
          <Select
            value={item}
            onValueChange={(v) => {
              setItem(v as "internal" | "barcode");
              setCheck(null);
            }}
          >
            <SelectTrigger size="default" className="mt-1 h-9 w-full rounded-xl" aria-label="Барааны код">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Дотоод код</SelectItem>
              <SelectItem value="barcode">Баркод</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={runCheck} disabled={busy || !range.from || !range.to}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Шалгах
        </Button>
        <Button asChild>
          <a href={href}>
            <Download className="h-4 w-4" />
            Файл татах
          </a>
        </Button>
        {check && (
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            <b className="text-foreground">{check.documents}</b> баримт · <b className="text-foreground">{check.lines}</b> мөр ·{" "}
            <b className="text-foreground">{formatMnt(check.total ?? 0)}</b>
          </span>
        )}
      </div>

      {check && (check.warnings?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1 rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-950 ring-1 ring-amber-300/70 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60">
          {check.warnings!.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
      {check && check.documents === 0 && (
        <p className="mt-2 text-[12.5px] text-muted-foreground">Энэ хугацаанд хүргэлтэнд гарсан захиалга алга.</p>
      )}
    </div>
  );
}
