"use client";

import { useState, useTransition } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignPriceListToStores,
  previewPriceListMatches,
  type AssignCandidate,
} from "@/app/admin/price-lists/actions";

/**
 * Bulk "put these stores on this list" in two steps: search shows every
 * matching store (nothing changes yet), the admin unticks what doesn't
 * belong, then confirms. Stores already on ANOTHER list start unticked so
 * a broad word can't silently move a different chain.
 */
export function AutoAssignForm({ priceListId, listName }: { priceListId: string; listName: string }) {
  const [keywords, setKeywords] = useState("");
  const [address, setAddress] = useState(false);
  const [notes, setNotes] = useState(false);
  const [found, setFound] = useState<AssignCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assignable = (found ?? []).filter((s) => s.currentListId !== priceListId);
  const already = (found ?? []).length - assignable.length;
  const pickedCount = assignable.filter((s) => picked.has(s.id)).length;

  function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSearch(async () => {
      const r = await previewPriceListMatches(priceListId, { keywords, address, notes });
      if (r.error) {
        setFound(null);
        setError(r.error);
        return;
      }
      const stores = r.stores ?? [];
      setFound(stores);
      // Tick stores with no list; leave ones on another list for the admin to decide.
      setPicked(new Set(stores.filter((s) => s.currentListId === null).map((s) => s.id)));
    });
  }

  function toggle(id: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function apply() {
    const ids = assignable.filter((s) => picked.has(s.id)).map((s) => s.id);
    startSave(async () => {
      const r = await assignPriceListToStores(priceListId, ids);
      setConfirming(false);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.count ?? 0} дэлгүүрт «${listName}» оноогдлоо`);
      setFound(null);
      setPicked(new Set());
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="space-y-3">
        <div>
          <Label htmlFor="keywords" className="mb-1.5 block">
            Дэлгүүрийн нэрэнд орсон үг (таслалаар тусгаарла)
          </Label>
          <div className="flex gap-2">
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="жишээ нь: Nomin, Номин"
              className="flex-1"
            />
            <Button type="submit" variant="secondary" disabled={searching || !keywords.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Хайх
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
            <label className="inline-flex min-h-10 items-center gap-2">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={address} onChange={(e) => setAddress(e.target.checked)} />
              Хаягаас бас хайх
            </label>
            <label className="inline-flex min-h-10 items-center gap-2">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={notes} onChange={(e) => setNotes(e.target.checked)} />
              Тэмдэглэлээс бас хайх
            </label>
          </div>
        </div>
      </form>

      {error && <Callout tone="error">{error}</Callout>}

      {found && (
        <div className="rounded-xl ring-1 ring-border">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-[12.5px]">
            <span className="font-semibold">{found.length} дэлгүүр олдлоо</span>
            {already > 0 && <span className="text-muted-foreground">· {already} нь аль хэдийн энэ жагсаалттай</span>}
            {assignable.length > 0 && (
              <button
                type="button"
                className="ml-auto min-h-10 px-2 font-semibold text-primary"
                onClick={() =>
                  setPicked(pickedCount === assignable.length ? new Set() : new Set(assignable.map((s) => s.id)))
                }
              >
                {pickedCount === assignable.length ? "Бүгдийг болих" : "Бүгдийг сонгох"}
              </button>
            )}
          </div>
          {found.length === 0 ? (
            <p className="p-4 text-center text-[13px] text-muted-foreground">Тохирох дэлгүүр алга.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {found.map((s) => {
                const same = s.currentListId === priceListId;
                return (
                  <li key={s.id}>
                    <label className={`flex min-h-11 items-start gap-3 px-3 py-2 ${same ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                        checked={same || picked.has(s.id)}
                        disabled={same}
                        onChange={(e) => toggle(s.id, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block text-[13px] font-medium">
                          {s.name}
                          {!s.active && <span className="ml-1.5 text-[11px] text-muted-foreground">(идэвхгүй)</span>}
                        </span>
                        {s.address && <span className="block truncate text-[11.5px] text-muted-foreground">{s.address}</span>}
                      </span>
                      <span className="shrink-0 text-[11px]">
                        {same ? (
                          <span className="text-muted-foreground">Энэ жагсаалттай</span>
                        ) : s.currentListName ? (
                          <span className="text-amber-700 dark:text-amber-400">«{s.currentListName}»-аас шилжинэ</span>
                        ) : (
                          <span className="text-muted-foreground">Жишиг үнэ</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end border-t px-3 py-2">
            <Button type="button" disabled={pickedCount === 0 || saving} onClick={() => setConfirming(true)}>
              <Sparkles className="h-4 w-4" />
              Оноох ({pickedCount})
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${pickedCount} дэлгүүрт «${listName}» оноох уу?`}
        description="Эдгээр дэлгүүр энэ жагсаалтын үнээр захиалга өгнө. Өөр жагсаалттай байсан дэлгүүрүүд шилжинэ."
        confirmLabel="Оноох"
        pending={saving}
        onConfirm={apply}
      />
    </div>
  );
}
