"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { filterItems } from "@/features/farm/farm-stock";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useItems } from "@/lib/api/queries";
import { t, tInline, type MsgId } from "@/lib/i18n";
import type { Item, Unit } from "@/types/domain";

const UNITS: Unit[] = ["KG", "LTR", "QTY", "BG", "ROLL", "VIAL"];
type Draft = Omit<Item, "id" | "number" | "aliases"> & { id?: string; aliases: string };

const toDraft = (item?: Item): Draft =>
  item
    ? { ...item, aliases: item.aliases.join(", ") }
    : { name: "", nameUr: "", aliases: "", category: "", unit: "QTY", isFeed: false, active: true };

/** A9 — the item list (name, Urdu name, aliases, category, unit, active). An edit drawer opens on the right. */
export function ItemsSetup() {
  const items = useItems();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  if (items.isError) return <LoadError onRetry={() => items.refetch()} />;
  const categories = [...new Set((items.data ?? []).map((i) => i.category))].sort();
  const rows = filterItems(items.data ?? [], query, category, true);

  const columns: Column<Item>[] = [
    { key: "number", header: <Bi id="col.no" />, cell: (i) => <span className="num">{i.number}</span>, sortValue: (i) => i.number, align: "right" },
    { key: "name", header: <Bi id="items.nameEn" />, cell: (i) => <span className="font-medium">{i.name}</span>, sortValue: (i) => i.name },
    { key: "nameUr", header: <Bi id="items.nameUr" />, cell: (i) => <span lang="ur" dir="rtl">{i.nameUr}</span> },
    { key: "aliases", header: <Bi id="items.aliases" />, cell: (i) => <span className="text-muted">{i.aliases.join(", ")}</span> },
    { key: "category", header: <Bi id="filter.category" />, cell: (i) => i.category, sortValue: (i) => i.category },
    { key: "unit", header: <Bi id="line.unit" />, cell: (i) => t(`unit.${i.unit}`).en, sortValue: (i) => i.unit },
    {
      key: "active",
      header: <Bi id="farms.active" />,
      cell: (i) => <Bi id={i.active ? "farms.active" : "farms.inactive"} inline />,
      sortValue: (i) => Number(i.active),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          <Bi id="nav.items" />
        </h1>
        <button type="button" className="btn btn-primary" onClick={() => setDraft(toDraft())}>
          <Plus size={18} aria-hidden />
          <Bi id="items.add" inline />
        </button>
      </div>
      <div className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <Bi id="filter.item" />
          <input type="search" data-search dir="auto" className="input min-h-10" placeholder={tInline("line.searchHint")} value={query} onChange={(e) => setQuery(e.target.value)} />
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
      {!items.data ? (
        <SkeletonRows rows={8} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(i) => i.id}
          onOpen={(i) => setDraft(toDraft(items.data!.find((x) => x.id === i.id)))}
          initialSort={{ key: "name", dir: "asc" }}
        />
      )}
      {draft && <ItemDrawer key={draft.id ?? "new"} initial={draft} categories={categories} onClose={() => setDraft(null)} />}
    </div>
  );
}

function ItemDrawer({ initial, categories, onClose }: { initial: Draft; categories: string[]; onClose: () => void }) {
  const titleId = useId();
  const listId = useId();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<MsgId | null>(null);
  const save = useApiMutation(api.saveItem);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  return (
    <aside
      role="dialog"
      aria-labelledby={titleId}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col gap-3 overflow-y-auto border-l border-line bg-surface p-4 shadow-xl"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="text-lg font-semibold">
          <Bi id={d.id ? "items.edit" : "items.add"} />
        </h2>
        <button type="button" className="btn min-h-10" onClick={onClose} aria-label={tInline("common.close")}>
          <X size={18} aria-hidden />
        </button>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await save.mutateAsync({ ...d, aliases: d.aliases.split(","), by: "Accounts Admin" });
            onClose();
          } catch (err) {
            setError(err instanceof ApiError ? err.id : "err.notSaved");
          }
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="items.nameEn" />
          <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="items.nameUr" />
          <input className="input" lang="ur" dir="rtl" value={d.nameUr} onChange={(e) => set({ nameUr: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="items.aliases" />
          <input className="input" dir="auto" value={d.aliases} onChange={(e) => set({ aliases: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="filter.category" />
          <input className="input" list={listId} value={d.category} onChange={(e) => set({ category: e.target.value })} />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="line.unit" />
          <select className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value as Unit })}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {tInline(`unit.${u}`)}
              </option>
            ))}
          </select>
          {d.id && (
            <span className="text-xs font-normal text-muted">
              <Bi id="items.unitLocked" inline />
            </span>
          )}
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={d.isFeed} onChange={(e) => set({ isFeed: e.target.checked })} />
          <Bi id="items.isFeed" inline />
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />
          <Bi id="farms.active" inline />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            <Bi id={error} inline />
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          <Bi id="slip.save" inline />
        </button>
      </form>
    </aside>
  );
}
