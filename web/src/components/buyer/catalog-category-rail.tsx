import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { type CategoryRow } from "@/lib/categories";
import { AllCategoriesIcon, categoryIcon } from "@/lib/category-icon";

type Props = {
  categories: CategoryRow[];
  activeId?: string;
  /** Preserved when building hrefs so chip clicks keep the buyer's search + sort. */
  q?: string;
  sort?: string;
};

export function CatalogCategoryRail({ categories, activeId, q, sort }: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pt-3 pb-2 -mx-3 px-3 sm:-mx-4 sm:px-4 scrollbar-thin snap-x snap-proximity"
      role="tablist"
      aria-label="Категори"
    >
      <CategoryCard
        href={buildHref({ q, sort })}
        icon={AllCategoriesIcon}
        label="Бүгд"
        active={!activeId}
      />
      {categories.map((c) => (
        <CategoryCard
          key={c.id}
          href={buildHref({ q, sort, category: c.id })}
          icon={categoryIcon(c.name)}
          label={shortLabel(c.name)}
          active={activeId === c.id}
        />
      ))}
    </div>
  );
}

function CategoryCard({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className="group snap-start shrink-0 w-[78px] flex flex-col items-center gap-1.5 select-none focus:outline-none"
    >
      <div
        className={`size-14 rounded-2xl flex items-center justify-center transition-all duration-300 ease-out group-active:scale-95 ${
          active
            ? "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/30 ring-1 ring-primary/40 scale-[1.04]"
            : "bg-muted/60 text-foreground/70 ring-1 ring-border/60 group-hover:bg-muted group-hover:text-foreground group-hover:ring-border"
        }`}
      >
        <Icon
          className="h-[22px] w-[22px]"
          strokeWidth={active ? 2.25 : 2}
        />
      </div>
      <span
        className={`text-[10.5px] leading-tight text-center line-clamp-2 font-medium transition-colors ${
          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

function buildHref({
  q,
  category,
  sort,
}: {
  q?: string;
  category?: string;
  sort?: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
}

function shortLabel(name: string): string {
  const commaIdx = name.indexOf(",");
  const head = commaIdx > -1 ? name.slice(0, commaIdx) : name;
  return head.split(/\s+/).slice(0, 2).join(" ");
}
