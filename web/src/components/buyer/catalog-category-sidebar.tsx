import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { type CategoryRow } from "@/lib/categories";
import { AllCategoriesIcon, categoryIcon } from "@/lib/category-icon";

type Props = {
  categories: CategoryRow[];
  activeId?: string;
  /** Preserved when building hrefs so sidebar clicks keep the buyer's
   *  search query + sort. */
  q?: string;
  sort?: string;
  /** Optional total / per-category counts for the badge on each row. */
  totalCount?: number;
  perCategoryCount?: Map<string, number>;
};

/**
 * Vertical category sidebar shown on lg+ viewports as an alternative to
 * the horizontal icon-card rail. Matches the Hi-Fi DesktopBuyerCatalog
 * sidebar: "Ангилал" label header + vertical list of category links with
 * primary-fill active state and optional count badges.
 */
export function CatalogCategorySidebar({
  categories,
  activeId,
  q,
  sort,
  totalCount,
  perCategoryCount,
}: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Категори"
      className="flex flex-col gap-1"
    >
      <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-2 px-1">
        Ангилал
      </div>

      <CategoryRow
        href={buildHref({ q, sort })}
        icon={AllCategoriesIcon}
        label="Бүгд"
        count={totalCount}
        active={!activeId}
      />
      {categories.map((c) => (
        <CategoryRow
          key={c.id}
          href={buildHref({ q, sort, category: c.id })}
          icon={categoryIcon(c.name)}
          label={c.name}
          count={perCategoryCount?.get(c.id)}
          active={activeId === c.id}
        />
      ))}
    </nav>
  );
}

function CategoryRow({
  href,
  icon: Icon,
  label,
  count,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`group h-9 px-3 rounded-lg flex items-center gap-2.5 text-[12.5px] transition-all ${
        active
          ? "bg-primary text-primary-foreground font-bold shadow-sm shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
          : "text-foreground/80 hover:bg-muted font-medium"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`}
        strokeWidth={active ? 2.4 : 2}
      />
      <span className="truncate flex-1 text-left">{label}</span>
      {count != null && (
        <span
          className={`text-[10.5px] tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}
        >
          {count}
        </span>
      )}
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
