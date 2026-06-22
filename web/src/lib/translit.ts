/**
 * Mongolian Cyrillic → Latin romanization for cross-script search.
 *
 * Data is stored in either Cyrillic ("Кока кола") or Latin ("OralGos").
 * Buyers often type on a Latin keyboard. Romanizing BOTH the stored text
 * and the query to a common Latin form lets "kola" match "кола" and
 * "soni" match "сони". Latin text passes through unchanged, so Latin
 * names stay findable by Latin queries too.
 *
 * This mirrors the SQL `mn_romanize()` (docs/fixes/32-search-translit.sql)
 * in spirit. They don't have to be byte-identical: each side romanizes
 * BOTH its query and its data, so consistency only matters within one
 * engine (SQL for catalog, JS for the in-form pickers).
 *
 * The mapping is phonetic and intentionally lossy — c/k, accents, soft
 * signs etc. are collapsed — because the goal is "find it", not reversible
 * transliteration.
 */

// Multi-character expansions — applied before the single-char table.
// Order matters only in that these run first (they emit Latin letters
// that the single map then leaves alone).
const MULTI: ReadonlyArray<readonly [string, string]> = [
  ["ё", "yo"],
  ["ц", "ts"],
  ["ч", "ch"],
  ["ш", "sh"],
  ["щ", "sh"],
  ["ю", "yu"],
  ["я", "ya"],
];

const SINGLE: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "j", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "h",
  э: "e", ы: "y", ь: "", ъ: "",
};

/** Romanize a string to its phonetic Latin form (lowercased). */
export function romanize(input: string): string {
  let s = input.toLowerCase();
  for (const [c, r] of MULTI) {
    if (s.includes(c)) s = s.split(c).join(r);
  }
  let out = "";
  for (const ch of s) out += SINGLE[ch] ?? ch;
  return out;
}

/**
 * Full search-normalize: strip Latin accents, romanize Cyrillic, collapse
 * whitespace. Use this on both the haystack and the query so substring
 * matching is script- and accent-insensitive.
 */
export function searchNormalize(s: string): string {
  const deaccented = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return romanize(deaccented).replace(/\s+/g, " ").trim();
}
