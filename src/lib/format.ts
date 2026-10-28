import type { Unit } from "@/types/domain";

const qtyFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** 9000 → "9,000". Always English digits. */
export function fmtQty(n: number) {
  return qtyFormat.format(n);
}

/** "9,000" → 9000; blank or invalid → null. */
export function parseQty(text: string): number | null {
  const trimmed = text.replace(/,/g, "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

/** Decimals are allowed only for weighed or measured units. */
export function allowsDecimals(unit: Unit) {
  return unit === "KG" || unit === "LTR";
}

/** Normalises text for item search: case, Arabic vs Urdu letter forms, diacritics. */
export function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ه/g, "ہ")
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
