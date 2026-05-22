import {
  Droplets,
  Heart,
  LayoutGrid,
  Leaf,
  Layers,
  Smile,
  Sparkles,
  SprayCan,
  Tag,
  UtensilsCrossed,
  Wind,
  type LucideIcon,
} from "lucide-react";

/**
 * Heuristic keyword → icon mapping for category cards. Categories are
 * user-editable in the DB so we can't ship a hard-coded ID table; instead we
 * match against substrings in the localized name. Falls back to a neutral
 * Tag for unknown categories.
 *
 * Ordering matters: earlier rules win. Specific food / eco / paper matches
 * have to come BEFORE the generic laundry / cleaning / face rules,
 * otherwise e.g. "Эко Угаалгын ялтас" matches `угаа` and gets droplets
 * instead of a leaf, and "Уургийн паста гоймон" matches `паст` (toothpaste)
 * and gets a brush instead of a noodle bowl.
 */
const RULES: ReadonlyArray<{ match: RegExp; icon: LucideIcon }> = [
  // 1. Food (pasta / noodles / general kitchen). MUST come before the
  //    oral-care rule because "паст" also appears in toothpaste contexts.
  { match: /(паст|гоймон|хүнс|food|таваг|noodl|kitchen)/i, icon: UtensilsCrossed },

  // 2. Paper / wipes / napkins — own bucket so disinfecting wipes look
  //    like wipes, not a generic sparkle.
  { match: /(салфетк|цаас|wipe|tissue|napkin|туалет)/i, icon: Layers },

  // 3. Face / personal cleansing (cotton pads, face care). MUST come
  //    before the eco rule because "Нүүр цэвэрлэх байгалийн гаралтай
  //    хөвөн" contains "байгал" which the eco rule would otherwise grab.
  { match: /(нүүр|face|арьс|skin|хөвөн|cotton)/i, icon: Sparkles },

  // 4. Eco / natural — matched before laundry so "Эко Угаалгын ялтас"
  //    gets a leaf rather than droplets.
  { match: /(эко|байгал|eco|natural|био)/i, icon: Leaf },

  // 5. Oral care — toothpaste, brushes, mouthwash. The food rule above
  //    already snags pasta, so this safely matches the oral-care category.
  { match: /(шүд|ам арчилгаа|oral|teeth|щётк|brush|toothpaste)/i, icon: Smile },

  // 6. Health & wellness — patches, vitamins, supplements.
  { match: /(эрүүл|мэнд|health|витамин|vitam|наалт|patch)/i, icon: Heart },

  // 7. Disinfecting / sprays.
  { match: /(ариут|disinfect|стерил|спрей|spray)/i, icon: SprayCan },

  // 8. Laundry / home cleaning / wash tablets.
  { match: /(угаа|стир|laundry|wash|гэр ах|ялта|цэвэрл)/i, icon: Droplets },

  // 9. Air fresheners.
  { match: /(сэрүү|fresh|агаар|air)/i, icon: Wind },
];

export function categoryIcon(name: string): LucideIcon {
  for (const rule of RULES) {
    if (rule.match.test(name)) return rule.icon;
  }
  return Tag;
}

export { LayoutGrid as AllCategoriesIcon };
