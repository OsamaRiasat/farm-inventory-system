"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ClipboardCheck, Search } from "lucide-react";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useItems, useStock } from "@/lib/api/queries";
import { fmtQty, normalizeSearch } from "@/lib/format";
import { t, tInline } from "@/lib/i18n";
import type { Item } from "@/types/domain";

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

/** F8 — every item with quantity on hand; items at 0 greyed at the bottom. Rows open the stock card. */
export function FarmStock() {
  const { farm } = useCurrentFarm();
  const items = useItems();
  const stock = useStock(farm.id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const categories = [...new Set((items.data ?? []).map((i) => i.category))].sort();
  const rows = filterItems(items.data ?? [], query, category)
    .map((item) => ({ item, qty: stock.data?.get(item.id) ?? 0 }))
    .sort((a, b) => Number(a.qty === 0) - Number(b.qty === 0) || a.item.name.localeCompare(b.item.name));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          <Bi id="stock.title" />
        </h1>
        <Link href="/farm/stock-count/new" className="btn">
          <ClipboardCheck size={18} aria-hidden />
          <Bi id="count.title" inline />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
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
      ) : rows.length === 0 ? (
        <p className="card p-4 text-muted">
          <Bi id="table.empty" />
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map(({ item, qty }) => (
            <li key={item.id}>
              <Link
                href={`/farm/stock/${encodeURIComponent(item.id)}`}
                className={clsx("flex items-center gap-3 px-4 py-2 hover:bg-surface-2", qty === 0 && "text-muted opacity-70")}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div lang="ur" dir="rtl" className="text-left text-sm text-muted">
                    {item.nameUr}
                  </div>
                </div>
                <div className="num shrink-0 text-right">
                  <span className="text-lg font-semibold">{fmtQty(qty)}</span>{" "}
                  <span className="text-sm text-muted">{t(`unit.${item.unit}`).en}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
