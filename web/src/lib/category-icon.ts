import {
  Brush,
  Droplets,
  Heart,
  LayoutGrid,
  Leaf,
  Smile,
  Soup,
  Sparkles,
  SprayCan,
  Tag,
  Wind,
  type LucideIcon,
} from "lucide-react";

/**
 * Heuristic keyword → icon mapping for category cards. Categories are
 * user-editable in the DB so we can't ship a hard-coded ID table; instead we
 * match against substrings in the localized name. Falls back to a neutral Tag.
 *
 * Ordering matters: earlier rules win, so put the most specific keywords first.
 */
const RULES: ReadonlyArray<{ match: RegExp; icon: LucideIcon }> = [
  // Oral care — toothpaste / brushes
  { match: /(паст|щётк|brush)/i, icon: Brush },
  { match: /(ам|шүд|oral|teeth)/i, icon: Smile },

  // Surface / disinfecting wipes & sprays
  { match: /(спрей|spray|сал[фп])/i, icon: SprayCan },
  { match: /(ариут|disinfect|стерил)/i, icon: Sparkles },

  // Face / personal cleansing
  { match: /(нүүр|face|арьс|skin)/i, icon: Sparkles },

  // Laundry / home wash
  { match: /(угаа|стир|laundry|wash|гэр ах)/i, icon: Droplets },

  // Health & wellness
  { match: /(эрүүл|мэнд|health|витамин|vitam)/i, icon: Heart },

  // Eco / natural
  { match: /(эко|байгал|eco|natural)/i, icon: Leaf },

  // Food adjacent (uncommon here, but plausible)
  { match: /(хүнс|food|таваг|kitchen)/i, icon: Soup },

  // Air fresheners
  { match: /(сэрүү|fresh|агаар|air)/i, icon: Wind },
];

export function categoryIcon(name: string): LucideIcon {
  for (const rule of RULES) {
    if (rule.match.test(name)) return rule.icon;
  }
  return Tag;
}

export { LayoutGrid as AllCategoriesIcon };
