"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useState } from "react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { filterItems } from "@/features/farm/farm-stock";
import { useFarms, useItems, useStockMatrix } from "@/lib/api/queries";
import { fmtQty } from "@/lib/format";
import { t, tInline } from "@/lib/i18n";
import type { Item } from "@/types/domain";

type Row = { item: Item; perFarm: Record<string, number>; total: number; transit: number };

/**
 * A4 — All farms: item × farm matrix with the All Farms total and In transit (first column and header stay put).
 * One farm (top bar): that farm's list; rows open the item's stock card.
 */
export function AdminStock() {
  const router = useRouter();
  const farmId = useAdminFarm();
  const farms = (useFarms().data ?? []).filter((f) => f.active);
  const items = useItems();
  const matrix = useStockMatrix();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  if (items.isError || matrix.isError) return <LoadError onRetry={() => void Promise.all([items.refetch(), matrix.refetch()])} />;
  if (!items.data || !matrix.data) return <SkeletonRows rows={10} />;

  const { farms: byFarm, inTransit } = matrix.data;
  const categories = [...new Set(items.data.map((i) => i.category))].sort();
  const rows: Row[] = filterItems(items.data, query, category).map((item) => {
    const perFarm = Object.fromEntries(farms.map((f) => [f.id, byFarm[f.id]?.[item.id] ?? 0]));
    return { item, perFarm, total: Object.values(perFarm).reduce((a, b) => a + b, 0), transit: inTransit[item.id] ?? 0 };
  });
  const unit = (item: Item) => t(`unit.${item.unit}`).en;
  const qty = (n: number) => <span className={clsx(n === 0 && "text-muted")}>{fmtQty(n)}</span>;

  const itemColumn: Column<Row> = {
    key: "item",
    header: <Bi id="line.item" />,
    cell: (r) => (
      <div className="min-w-44">
        <div className="font-medium">{r.item.name}</div>
        <div className="text-xs text-muted">{unit(r.item)}</div>
      </div>
    ),
    sortValue: (r) => r.item.name,
  };

  const columns: Column<Row>[] = farmId
    ? [
        itemColumn,
        { key: "category", header: <Bi id="stock.category" />, cell: (r) => r.item.category, sortValue: (r) => r.item.category },
        { key: "qty", header: <Bi id="card.balance" />, cell: (r) => qty(r.perFarm[farmId] ?? 0), sortValue: (r) => r.perFarm[farmId] ?? 0, align: "right" },
      ]
    : [
        itemColumn,
        ...farms.map(
          (f): Column<Row> => ({
            key: f.id,
            header: <span className="whitespace-nowrap">{f.code}</span>,
            cell: (r) => (
              <Link href={`/admin/stock/${f.id}/${encodeURIComponent(r.item.id)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                {qty(r.perFarm[f.id])}
              </Link>
            ),
            sortValue: (r) => r.perFarm[f.id],
            align: "right",
          }),
        ),
        { key: "total", header: <Bi id="admin.allFarms" />, cell: (r) => <strong>{fmtQty(r.total)}</strong>, sortValue: (r) => r.total, align: "right" },
        { key: "transit", header: <Bi id="rep.inTransit" />, cell: (r) => qty(r.transit), sortValue: (r) => r.transit, align: "right" },
      ];

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.stock" />
      </h1>
      <div className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label className="relative flex min-w-56 flex-1 flex-col gap-1">
          <Bi id="filter.item" />
          <Search size={18} className="absolute bottom-3 left-3 text-muted" aria-hidden />
          <input type="search" data-search dir="auto" className="input min-h-10 pl-9" placeholder={tInline("line.searchHint")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="flex w-48 flex-col gap-1">
          <Bi id="filter.category" />
          <select className="input min-h-10" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{tInline("stock.allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!farmId && (
        <p className="text-sm text-muted">
          <Bi id="stock.matrixHint" inline />
        </p>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.item.id}
        onOpen={farmId ? (r) => router.push(`/admin/stock/${farmId}/${encodeURIComponent(r.item.id)}`) : undefined}
        initialSort={{ key: "item", dir: "asc" }}
        pageSize={100}
      />
    </div>
  );
}
