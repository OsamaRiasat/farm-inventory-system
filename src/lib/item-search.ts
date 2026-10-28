import Fuse from "fuse.js";
import { normalizeSearch } from "@/lib/format";
import type { Item } from "@/types/domain";

type Doc = { item: Item; name: string; nameUr: string; aliases: string[]; number: string; all: string };

/**
 * Item search for C1 and the API's searchItems.
 * 1. Exact: every typed word appears in the English name, Urdu name, an alias or the item number
 *    ("belt 89a", "فین بیلٹ", "193"). Names that start with the query come first.
 * 2. Fuzzy (Fuse.js): catches spelling variants such as "Chian Lock" or "deisel".
 * Urdu letter forms are normalised first (ی/ي, ک/ك), see normalizeSearch.
 */
export function createItemSearch(items: Item[]) {
  const docs: Doc[] = items
    .filter((i) => i.active)
    .map((item) => ({
      item,
      name: normalizeSearch(item.name),
      nameUr: normalizeSearch(item.nameUr),
      aliases: item.aliases.map(normalizeSearch),
      number: String(item.number),
      all: normalizeSearch([item.name, item.nameUr, ...item.aliases, item.number].join(" ")),
    }));

  const fuse = new Fuse(docs, {
    keys: [
      { name: "name", weight: 2 },
      { name: "nameUr", weight: 2 },
      { name: "aliases", weight: 1 },
      { name: "number", weight: 0.5 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  });

  return function search(query: string, limit = 8): Item[] {
    const q = normalizeSearch(query);
    if (!q) return [];
    const words = q.split(" ");
    const exact = docs
      .filter((d) => words.every((w) => d.all.includes(w)))
      .sort((a, b) => rank(a, q) - rank(b, q));
    const seen = new Set(exact);
    const fuzzy = fuse
      .search(q)
      .map((r) => r.item)
      .filter((d) => !seen.has(d));
    return [...exact, ...fuzzy].slice(0, limit).map((d) => d.item);
  };
}

function rank(d: Doc, q: string) {
  if (d.name.startsWith(q) || d.nameUr.startsWith(q) || d.number === q) return 0;
  if (d.aliases.some((a) => a.startsWith(q))) return 1;
  return 2;
}
