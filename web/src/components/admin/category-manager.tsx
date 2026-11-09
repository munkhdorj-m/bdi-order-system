"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_KEYS,
  CategoryIconTile,
  categoryVisual,
  type CategoryIconKey,
} from "@/lib/category-visual";
import { cn } from "@/lib/utils";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from "@/app/admin/categories/actions";

export type ManagedCategory = {
  id: string;
  name: string;
  icon: string | null;
  visible: number;
  hidden: number;
  deals: number;
  photos: { src: string; alt: string }[];
};

/** Grid of every picture an admin can give a category. */
function IconPicker({
  name,
  value,
  onPick,
  disabled,
}: {
  name: string;
  value: string | null;
  onPick: (key: CategoryIconKey) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visual = categoryVisual({ name, icon: value });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Дүрс солих"
          aria-label={`${name || "Ангилал"} — дүрс солих`}
          className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
        >
          <CategoryIconTile visual={visual} size="lg" className="hover:ring-2 hover:ring-primary/30" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-3">
        <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Дүрс сонгох</div>
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORY_ICON_KEYS.map((key) => {
            const v = categoryVisual({ name: "", icon: key });
            const selected = key === visual.key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onPick(key);
                  setOpen(false);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg p-1.5 text-center hover:bg-muted",
                  selected && "bg-muted ring-2 ring-primary/50",
                )}
              >
                <CategoryIconTile visual={v} size="md" />
                <span className="line-clamp-2 text-[9.5px] leading-tight text-muted-foreground">
                  {CATEGORY_ICONS[key].label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NewCategory() {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await createCategory({ name, icon });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`«${name.trim()}» ангилал нэмлээ`);
      setName("");
      setIcon(null);
    });
  }

  return (
    <Card className="mb-4 p-3">
      <form onSubmit={submit} className="flex items-center gap-3">
        <IconPicker name={name} value={icon} onPick={setIcon} disabled={pending} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Шинэ ангиллын нэр, жишээ нь: Угаалгын нунтаг"
          maxLength={60}
          className="h-10 flex-1"
          aria-label="Шинэ ангиллын нэр"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Нэмэх
        </Button>
      </form>
    </Card>
  );
}

function CategoryRow({
  c,
  index,
  total,
}: {
  c: ManagedCategory;
  index: number;
  total: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const empty = c.visible + c.hidden === 0;

  function run(task: () => Promise<{ error?: string }>, ok?: string, after?: () => void) {
    start(async () => {
      const r = await task();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (ok) toast.success(ok);
      after?.();
    });
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap", pending && "opacity-60")}>
      {/* 40px tap targets on phones, compact on a desktop. */}
      <div className="flex sm:flex-col">
        <button
          type="button"
          onClick={() => run(() => moveCategory(c.id, "up"))}
          disabled={pending || index === 0}
          aria-label={`${c.name} — дээш`}
          className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 sm:size-7"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => run(() => moveCategory(c.id, "down"))}
          disabled={pending || index === total - 1}
          aria-label={`${c.name} — доош`}
          className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 sm:size-7"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <IconPicker
        name={c.name}
        value={c.icon}
        disabled={pending}
        onPick={(key) => run(() => updateCategory(c.id, { icon: key }), "Дүрс солигдлоо")}
      />

      <div className="min-w-0 flex-1 basis-40">
        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateCategory(c.id, { name: draft }), "Нэр солигдлоо", () => setEditing(false));
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={60}
              autoFocus
              className="h-9"
              aria-label="Ангиллын нэр"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(c.name);
                  setEditing(false);
                }
              }}
            />
            <Button type="submit" size="icon-sm" disabled={pending} aria-label="Хадгалах">
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Болих"
              onClick={() => {
                setDraft(c.name);
                setEditing(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{c.name}</span>
            <button
              type="button"
              onClick={() => {
                setDraft(c.name);
                setEditing(true);
              }}
              aria-label={`${c.name} — нэр солих`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          {empty ? (
            "Бараагүй"
          ) : (
            <>
              <span className={c.visible > 0 ? "font-semibold text-foreground" : ""}>{c.visible} харагдана</span>
              {c.hidden > 0 && <> · {c.hidden} нуусан</>}
            </>
          )}
          {c.deals > 0 && <> · {c.deals} хямдрал</>}
          {c.visible === 0 && !empty && <> · дэлгүүрт харагдахгүй</>}
        </div>
      </div>

      <div className="hidden items-center -space-x-2 md:flex">
        {c.photos.map((p) => (
          <Image
            key={p.src}
            src={p.src}
            alt={p.alt}
            width={36}
            height={36}
            unoptimized
            className="size-9 rounded-full object-cover ring-2 ring-card"
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {confirmDelete ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Болих
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteCategory(c.id), `«${c.name}» устгагдлаа`)}
            >
              Устгах
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/products?category=${c.id}`}>
                Бараа
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={pending || !empty || c.deals > 0}
              title={empty ? "Устгах" : "Бараатай ангиллыг устгах боломжгүй"}
              aria-label={`${c.name} — устгах`}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function CategoryManager({ categories }: { categories: ManagedCategory[] }) {
  return (
    <>
      <NewCategory />
      <Card className="gap-0 overflow-hidden p-0">
        {categories.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Ангилал алга байна.</p>
        ) : (
          <ul className="divide-y">
            {categories.map((c, i) => (
              <CategoryRow key={c.id} c={c} index={i} total={categories.length} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
