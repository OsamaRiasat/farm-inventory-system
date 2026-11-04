"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ClipboardCheck, FileSpreadsheet, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useItems, useStock } from "@/lib/api/queries";
import { fmtDate, today } from "@/lib/dates";
import { downloadCsv, takePrintFlag } from "@/lib/export";
import { fmtQty, normalizeSearch } from "@/lib/format";
import { t, tInline } from "@/lib/i18n";
import type { Farm, Item } from "@/types/domain";

/** Item list filtered by search text (English, Urdu, alias, number) and category. Active items only, unless asked. */
export function filterItems(items: Item[], query: string, category: string, includeInactive = false) {
  const q = normalizeSearch(query);
  return items.filter(
    (i) =>
      (includeInactive || i.active) &&
      (!category || i.category === category) &&
      (!q || normalizeSearch(`${i.name} ${i.nameUr} ${i.aliases.join(" ")} ${i.number}`).includes(q)),
  );
}

/** Stock report for Excel: one row per item, in the order the screen shows. */
export function exportStock(farm: Farm, rows: { item: Item; qty: number }[]) {
  downloadCsv(`${farm.code} stock ${today()}`, [
    ["Item No.", "Item", "Item (Urdu)", "Category", "In stock", "Unit"],
    ...rows.map(({ item, qty }) => [item.number, item.name, item.nameUr, item.category, qty, t(`unit.${item.unit}`).en]),
  ]);
}

/** Items with their stock, items at 0 last. */
export function stockRows(items: Item[], stock: Map<string, number> | undefined) {
  return items
    .map((item) => ({ item, qty: stock?.get(item.id) ?? 0 }))
    .sort((a, b) => Number(a.qty === 0) - Number(b.qty === 0) || a.item.name.localeCompare(b.item.name));
}

/**
 * F8 — items with quantity on hand; items at 0 greyed at the bottom. With 1,970 items, the ones at 0 show only
 * when searching, picking a category or asking for them. Rows open the stock card.
 * Excel downloads what's on screen; PDF prints it (opened with ?print=1 from Home, it prints straight away).
 */
export function FarmStock() {
  const { farm } = useCurrentFarm();
  const items = useItems();
  const stock = useStock(farm.id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showZero, setShowZero] = useState(false);

  const categories = [...new Set((items.data ?? []).map((i) => i.category))].sort();
  const all = stockRows(filterItems(items.data ?? [], query, category), stock.data);
  const rows = showZero || query || category ? all : all.filter((r) => r.qty !== 0);
  const hidden = all.length - rows.length;
  const loaded = !!items.data && !!stock.data;

  useEffect(() => {
    if (loaded && takePrintFlag()) window.print();
  }, [loaded]);

  return (
    <div className="print-area flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          <Bi id="stock.title" />
        </h1>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="btn" disabled={!loaded} onClick={() => exportStock(farm, rows)}>
            <FileSpreadsheet size={18} aria-hidden />
            <Bi id="export.excel" inline />
          </button>
          <button type="button" className="btn" disabled={!loaded} onClick={() => window.print()}>
            <Printer size={18} aria-hidden />
            <Bi id="export.pdf" inline />
          </button>
          <Link href="/farm/stock-count/new" className="btn">
            <ClipboardCheck size={18} aria-hidden />
            <Bi id="count.title" inline />
          </Link>
        </div>
      </div>
      <p className="hidden text-sm print:block">
        {farm.name} · {fmtDate(today())}
      </p>
      <div className="flex flex-wrap gap-2 print:hidden">
        <div className="relative min-w-56 flex-1">
          <Search size={20} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            data-search
            dir="auto"
            className="input pl-10"
            placeholder={tInline("line.searchHint")}
            aria-label={tInline("line.searchHint")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={tInline("stock.category")}>
          <option value="">{tInline("stock.allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {items.isError || stock.isError ? (
        <LoadError onRetry={() => void Promise.all([items.refetch(), stock.refetch()])} />
      ) : !items.data || !stock.data ? (
        <SkeletonRows rows={8} />
      ) : rows.length === 0 && !hidden ? (
        <p className="card p-4 text-muted">
          <Bi id="table.empty" />
        </p>
      ) : (
        <>
          <ul className="card divide-y divide-line">
            {rows.map(({ item, qty }) => (
              <li key={item.id}>
                <Link
                  href={`/farm/stock/${encodeURIComponent(item.id)}`}
                  className={clsx("flex items-center gap-3 px-4 py-2 hover:bg-surface-2", qty === 0 && "text-muted opacity-70")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{item.name}</div>
                    {item.nameUr ? (
                      <div lang="ur" dir="rtl" className="text-left text-sm text-muted">
                        {item.nameUr}
                      </div>
                    ) : (
                      <div className="text-sm text-muted">{item.category}</div>
                    )}
                  </div>
                  <div className="num shrink-0 text-right">
                    <span className="text-lg font-semibold">{fmtQty(qty)}</span>{" "}
                    <span className="text-sm text-muted">{t(`unit.${item.unit}`).en}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button type="button" className="btn self-start print:hidden" onClick={() => setShowZero(true)}>
              <Bi id="stock.showZero" values={{ n: fmtQty(hidden) }} inline />
            </button>
          )}
        </>
      )}
    </div>
  );
}
