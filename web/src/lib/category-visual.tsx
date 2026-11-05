import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  Baby,
  Bandage,
  Bot,
  BrushCleaning,
  ChefHat,
  CookingPot,
  Footprints,
  Gift,
  HandHeart,
  HeartPulse,
  History,
  House,
  LayoutGrid,
  Leaf,
  Pill,
  Shirt,
  ShowerHead,
  Smartphone,
  Soup,
  Sparkles,
  Tag,
  Toilet,
  UtensilsCrossed,
  WashingMachine,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One picture + one colour per product category, used everywhere a
 * category appears (store catalog, rep catalog, admin order entry, admin
 * products). Colour-coding lets people find a section by glance before
 * they read it.
 *
 * Admins pick the picture on /admin/categories (stored in
 * `categories.icon`, fix 38). Until one is picked, it's guessed from the
 * name, so a category renamed or added later still gets a sensible one.
 */

export type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

type SvgProps = SVGProps<SVGSVGElement> & { strokeWidth?: number };

/** Lucide-style outline icon (24×24, round caps) for shapes lucide lacks. */
function outlineIcon(displayName: string, children: ReactNode): IconComponent {
  function Icon({ className, strokeWidth = 2, ...rest }: SvgProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        {...rest}
      >
        {children}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/** Soft pack with a wipe pulled out of the flap, and a drop of water. */
const WipesIcon = outlineIcon(
  "WipesIcon",
  <>
    <rect x="2" y="9" width="20" height="12" rx="3.5" />
    <rect x="7" y="12" width="10" height="4" rx="2" />
    <path d="M9.5 14c-.2-3.6.5-6.9 2.1-8.6.6 1 1.5 1.5 2.6 1.4-.4 2.3-.6 4.7-.6 7.2" />
    <path d="M19.5 2.5s-1.4 1.6-1.4 2.5a1.4 1.4 0 0 0 2.8 0c0-.9-1.4-2.5-1.4-2.5z" />
  </>,
);

/** Tissue box with a sheet sticking out of the slot. */
const TissueIcon = outlineIcon(
  "TissueIcon",
  <>
    <rect x="3" y="12" width="18" height="9" rx="2" />
    <path d="M8 15h8" />
    <path d="M9 15c0-4.6 1.4-8.4 3.6-10.2.5 1.6 1.6 2.6 3 2.9-.8 2.3-1.3 4.8-1.3 7.3" />
  </>,
);

/** Toilet roll with a torn sheet hanging down the front. */
const ToiletPaperIcon = outlineIcon(
  "ToiletPaperIcon",
  <>
    <ellipse cx="7" cy="8" rx="4" ry="5" />
    <ellipse cx="7" cy="8" rx="1.3" ry="1.8" />
    <path d="M7 3h10a4 5 0 0 1 4 5v13" />
    <path d="M7 13v8" />
    <path d="M7 21l2.33-1 2.33 1 2.33-1 2.33 1 2.33-1 2.33 1" />
  </>,
);

/** Cotton bud. */
const CottonIcon = outlineIcon(
  "CottonIcon",
  <>
    <path d="M7.5 16.5l9-9" />
    <ellipse cx="18.6" cy="5.4" rx="2.3" ry="3.6" transform="rotate(45 18.6 5.4)" />
    <ellipse cx="5.4" cy="18.6" rx="2.3" ry="3.6" transform="rotate(45 5.4 18.6)" />
  </>,
);

/** Two-layer kitchen sponge with foam bubbles. */
const SpongeIcon = outlineIcon(
  "SpongeIcon",
  <>
    <rect x="3" y="10" width="18" height="10" rx="2.5" />
    <path d="M3 14h18" />
    <path d="M7.5 17h.01M12 17.4h.01M16.5 17h.01" />
    <circle cx="15" cy="5.5" r="1.8" />
    <circle cx="19" cy="4" r="1.1" />
    <circle cx="19.5" cy="7.6" r=".8" />
  </>,
);

/** Toothbrush with paste on the bristles. */
const ToothbrushIcon = outlineIcon(
  "ToothbrushIcon",
  <>
    <rect x="2" y="14.5" width="12" height="3.5" rx="1.75" />
    <rect x="14.5" y="13" width="7.5" height="3" rx="1" />
    <path d="M16 13v-3.5M18.25 13v-3.5M20.5 13v-3.5" />
    <path d="M15.3 7.2c1.8-1.6 4.7-1.6 6.2 0" />
  </>,
);

/** Belt buckle on a strap. */
const BeltIcon = outlineIcon(
  "BeltIcon",
  <>
    <rect x="6.5" y="6.5" width="8" height="11" rx="2" />
    <path d="M10.5 9.5v5" />
    <path d="M1.5 10h5M1.5 14h5" />
    <path d="M14.5 10h8M14.5 14h8" />
    <path d="M18 12h.01M21 12h.01" />
  </>,
);

/* ------------------------------------------------------------------ */
/* Colours. Full class strings so Tailwind keeps them in the build.    */
/* ------------------------------------------------------------------ */

export type Tone = {
  /** Icon tile: tinted background + strong foreground. */
  tile: string;
  /** Active chip / selected state. */
  solid: string;
  /** Very light wash, e.g. a photo placeholder. */
  wash: string;
  /** Coloured text only. */
  text: string;
};

const TONES = {
  sky: {
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    solid: "bg-sky-600 text-white dark:bg-sky-500",
    wash: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
  },
  amber: {
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    solid: "bg-amber-500 text-white dark:bg-amber-500",
    wash: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  violet: {
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    solid: "bg-violet-600 text-white dark:bg-violet-500",
    wash: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
  },
  emerald: {
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    solid: "bg-emerald-600 text-white dark:bg-emerald-500",
    wash: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  rose: {
    tile: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    solid: "bg-rose-600 text-white dark:bg-rose-500",
    wash: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
  },
  teal: {
    tile: "bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
    solid: "bg-teal-600 text-white dark:bg-teal-500",
    wash: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
  },
  orange: {
    tile: "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
    solid: "bg-orange-600 text-white dark:bg-orange-500",
    wash: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
  },
  blue: {
    tile: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    solid: "bg-blue-600 text-white dark:bg-blue-500",
    wash: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
  },
  lime: {
    tile: "bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300",
    solid: "bg-lime-600 text-white dark:bg-lime-500",
    wash: "bg-lime-50 dark:bg-lime-950/40",
    text: "text-lime-700 dark:text-lime-300",
  },
  pink: {
    tile: "bg-pink-100 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
    solid: "bg-pink-600 text-white dark:bg-pink-500",
    wash: "bg-pink-50 dark:bg-pink-950/40",
    text: "text-pink-700 dark:text-pink-300",
  },
  yellow: {
    tile: "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300",
    solid: "bg-yellow-500 text-yellow-950 dark:bg-yellow-500",
    wash: "bg-yellow-50 dark:bg-yellow-950/40",
    text: "text-yellow-800 dark:text-yellow-300",
  },
  cyan: {
    tile: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    solid: "bg-cyan-600 text-white dark:bg-cyan-500",
    wash: "bg-cyan-50 dark:bg-cyan-950/40",
    text: "text-cyan-700 dark:text-cyan-300",
  },
  indigo: {
    tile: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
    solid: "bg-indigo-600 text-white dark:bg-indigo-500",
    wash: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  red: {
    tile: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
    solid: "bg-red-600 text-white dark:bg-red-500",
    wash: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
  },
  purple: {
    tile: "bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
    solid: "bg-purple-600 text-white dark:bg-purple-500",
    wash: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
  },
  stone: {
    tile: "bg-stone-200 text-stone-700 dark:bg-stone-400/15 dark:text-stone-300",
    solid: "bg-stone-600 text-white dark:bg-stone-500",
    wash: "bg-stone-100 dark:bg-stone-900/50",
    text: "text-stone-700 dark:text-stone-300",
  },
  slate: {
    tile: "bg-slate-200 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
    solid: "bg-slate-600 text-white dark:bg-slate-500",
    wash: "bg-slate-100 dark:bg-slate-900/50",
    text: "text-slate-700 dark:text-slate-300",
  },
  primary: {
    tile: "bg-primary/10 text-primary dark:bg-primary/20",
    solid: "bg-primary text-primary-foreground",
    wash: "bg-primary/5",
    text: "text-primary",
  },
} satisfies Record<string, Tone>;

type ToneName = keyof typeof TONES;

/* ------------------------------------------------------------------ */
/* The pictures an admin can choose from.                              */
/* ------------------------------------------------------------------ */

type IconDef = { label: string; Icon: IconComponent; tone: ToneName };

export const CATEGORY_ICONS = {
  wipes: { label: "Нойтон салфетка", Icon: WipesIcon, tone: "sky" },
  tissue: { label: "Цаасан салфетка", Icon: TissueIcon, tone: "amber" },
  "toilet-paper": { label: "Ариун цэврийн цаас", Icon: ToiletPaperIcon, tone: "violet" },
  sponge: { label: "Спонж, угаагч", Icon: SpongeIcon, tone: "emerald" },
  cotton: { label: "Хөвөн", Icon: CottonIcon, tone: "rose" },
  toothbrush: { label: "Ам арчилгаа", Icon: ToothbrushIcon, tone: "teal" },
  patch: { label: "Наалт", Icon: Bandage, tone: "orange" },
  cleaning: { label: "Цэвэрлэгээ", Icon: BrushCleaning, tone: "blue" },
  laundry: { label: "Угаалга", Icon: WashingMachine, tone: "lime" },
  beauty: { label: "Гоо сайхан", Icon: Sparkles, tone: "pink" },
  pasta: { label: "Хүнс, гоймон", Icon: Soup, tone: "yellow" },
  bathroom: { label: "Ариун цэврийн өрөө", Icon: Toilet, tone: "cyan" },
  shower: { label: "Ванн, шүршүүр", Icon: ShowerHead, tone: "indigo" },
  "kitchen-mat": { label: "Гал тогооны хэрэглэл", Icon: ChefHat, tone: "red" },
  belt: { label: "Бүс, хувцас", Icon: BeltIcon, tone: "stone" },
  kitchen: { label: "Гал тогооны хэрэгсэл", Icon: CookingPot, tone: "orange" },
  robot: { label: "Робот, техник", Icon: Bot, tone: "slate" },
  massage: { label: "Массаж", Icon: HandHeart, tone: "purple" },
  phone: { label: "Утасны хэрэгсэл", Icon: Smartphone, tone: "slate" },
  shoe: { label: "Гутал", Icon: Footprints, tone: "stone" },
  air: { label: "Агаар, ариутгал", Icon: Wind, tone: "sky" },
  health: { label: "Эрүүл мэнд", Icon: HeartPulse, tone: "red" },
  pill: { label: "Эм, витамин", Icon: Pill, tone: "teal" },
  eco: { label: "Эко", Icon: Leaf, tone: "emerald" },
  food: { label: "Хүнс", Icon: UtensilsCrossed, tone: "amber" },
  baby: { label: "Хүүхдийн", Icon: Baby, tone: "pink" },
  clothes: { label: "Хувцас", Icon: Shirt, tone: "indigo" },
  home: { label: "Гэр ахуй", Icon: House, tone: "blue" },
  gift: { label: "Бэлэг", Icon: Gift, tone: "rose" },
  other: { label: "Бусад", Icon: Tag, tone: "slate" },
} satisfies Record<string, IconDef>;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIconKey[];

export function isCategoryIconKey(v: unknown): v is CategoryIconKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, v);
}

/**
 * Name → picture guess for categories without a chosen icon. Earlier rules
 * win, so the specific ones come first ("нойтон салфетка" before the
 * generic "салфетка", "гоймон" before anything containing "паст").
 */
const NAME_RULES: ReadonlyArray<{ match: RegExp; key: CategoryIconKey }> = [
  { match: /нойтон|wipe/i, key: "wipes" },
  { match: /ариун цэврийн цаас|toilet|ац цаас/i, key: "toilet-paper" },
  { match: /ариун цэврийн өрөө|бидэ|bidet/i, key: "bathroom" },
  { match: /салфетк|цаас|алчуур|tissue|napkin/i, key: "tissue" },
  { match: /спонж|порлон|угаагч|sponge/i, key: "sponge" },
  { match: /хөвөн|cotton/i, key: "cotton" },
  { match: /шүд|ам арчилгаа|oral|tooth/i, key: "toothbrush" },
  { match: /наалт|patch/i, key: "patch" },
  { match: /угаалгын ялтас|угаалга|laundry/i, key: "laundry" },
  { match: /гоймон|паста|pasta|хүнс/i, key: "pasta" },
  { match: /гоо сайхан|beauty|арьс|нүүр/i, key: "beauty" },
  { match: /ванн|шүршүүр|хөшиг|shower/i, key: "shower" },
  { match: /дэвсгэр|mat\b/i, key: "kitchen-mat" },
  { match: /гал тогоо|kitchen|миксер|шарагч/i, key: "kitchen" },
  { match: /бүс|тэлээ|belt/i, key: "belt" },
  { match: /робот|тоос сорогч|robot/i, key: "robot" },
  { match: /массаж|massag/i, key: "massage" },
  { match: /утас|phone|суурь/i, key: "phone" },
  { match: /гутал|shoe/i, key: "shoe" },
  { match: /ариутга|агаар|air/i, key: "air" },
  { match: /цэвэрлэ|clean/i, key: "cleaning" },
  { match: /эрүүл|мэнд|health/i, key: "health" },
  { match: /эко|eco|байгал/i, key: "eco" },
];

export type CategoryLike = { name: string; icon?: string | null };

export function categoryIconKey(cat: CategoryLike | null | undefined): CategoryIconKey {
  if (!cat) return "other";
  if (isCategoryIconKey(cat.icon)) return cat.icon;
  for (const rule of NAME_RULES) if (rule.match.test(cat.name)) return rule.key;
  return "other";
}

export type CategoryVisual = { key: CategoryIconKey; Icon: IconComponent; tone: Tone };

export function categoryVisual(cat: CategoryLike | null | undefined): CategoryVisual {
  const key = categoryIconKey(cat);
  const def = CATEGORY_ICONS[key];
  return { key, Icon: def.Icon, tone: TONES[def.tone] };
}

/** Pictures for the catalog's non-category sections. */
export const ALL_PRODUCTS_VISUAL: CategoryVisual = {
  key: "other",
  Icon: LayoutGrid,
  tone: TONES.primary,
};
export const USUAL_PRODUCTS_VISUAL: CategoryVisual = {
  key: "other",
  Icon: History,
  tone: TONES.primary,
};

const TILE_SIZES = {
  xs: { box: "size-6 rounded-md", icon: "h-3.5 w-3.5" },
  sm: { box: "size-8 rounded-lg", icon: "h-[18px] w-[18px]" },
  md: { box: "size-10 rounded-xl", icon: "h-5 w-5" },
  lg: { box: "size-12 rounded-2xl", icon: "h-6 w-6" },
} as const;

/**
 * Stand-in for a missing product photo: the category's picture on its
 * colour, so every card still says what kind of product it is. Fills the
 * nearest positioned parent.
 */
export function ProductPlaceholder({
  visual,
  dim = false,
  size = "md",
}: {
  visual: CategoryVisual;
  dim?: boolean;
  size?: "sm" | "md";
}) {
  const { Icon } = visual;
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center", visual.tone.wash, dim && "opacity-50")}>
      <div
        className={cn(
          "flex items-center justify-center",
          visual.tone.tile,
          size === "md" ? "size-16 rounded-2xl" : "size-full rounded-[inherit]",
        )}
      >
        <Icon className={size === "md" ? "h-9 w-9" : "h-5 w-5"} strokeWidth={size === "md" ? 1.6 : 1.9} />
      </div>
    </div>
  );
}

/**
 * The category's picture in a tinted rounded square. `active` swaps to the
 * solid colour (selected chip).
 */
export function CategoryIconTile({
  visual,
  size = "md",
  active = false,
  className,
}: {
  visual: CategoryVisual;
  size?: keyof typeof TILE_SIZES;
  active?: boolean;
  className?: string;
}) {
  const s = TILE_SIZES[size];
  const { Icon } = visual;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors",
        s.box,
        active ? visual.tone.solid : visual.tone.tile,
        className,
      )}
    >
      <Icon className={s.icon} strokeWidth={active ? 2.3 : 2} />
    </span>
  );
}
