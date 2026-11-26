"use client";

import { Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { filterItems } from "@/features/farm/farm-stock";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useFarms, useItemRequests, useItems } from "@/lib/api/queries";
import { fmtStamp } from "@/lib/dates";
import { t, tInline, type MsgId } from "@/lib/i18n";
import { UNITS, type Item, type ItemRequest, type Unit } from "@/types/domain";
import { useOnHide } from "@/lib/on-hide";

type Draft = Omit<Item, "id" | "number" | "aliases"> & { id?: string; aliases: string; requestId?: string };

const toDraft = (item?: Item): Draft =>
  item
    ? { ...item, aliases: item.aliases.join(", ") }
    : { name: "", nameUr: "", aliases: "", category: "", unit: "QTY", isFeed: false, active: true };

const fromRequest = (r: ItemRequest): Draft => ({
  name: r.name,
  nameUr: r.nameUr,
  aliases: "",
  category: r.category,
  unit: r.unit,
  isFeed: false,
  active: true,
  requestId: r.id,
});

/**
 * A9 — the item list (name, Urdu name, aliases, category, unit, active). An edit drawer opens on the right.
 * "Requested" (?show=requested, the dashboard tile) lists farms' new-item requests to approve or reject (client #30).
 */
export function ItemsSetup() {
  const items = useItems();
  const requests = useItemRequests({ status: "pending" });
  const farms = useFarms().data ?? [];
  const router = useRouter();
  const pathname = usePathname();
  const showRequested = useSearchParams().get("show") === "requested";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  useOnHide(() => setDraft(null));

  if (items.isError) return <LoadError onRetry={() => items.refetch()} />;
  const categories = [...new Set((items.data ?? []).map((i) => i.category))].sort();
  const rows = filterItems(items.data ?? [], query, category, true);

  const farmName = (id: string) => farms.find((f) => f.id === id)?.name ?? id;
  const requestColumns: Column<ItemRequest>[] = [
    { key: "at", header: <Bi id="slip.postedOn" />, cell: (r) => <span className="num whitespace-nowrap">{fmtStamp(r.at)}</span>, sortValue: (r) => r.at },
    { key: "farm", header: <Bi id="col.farm" />, cell: (r) => farmName(r.farmId), sortValue: (r) => farmName(r.farmId) },
    { key: "by", header: <Bi id="items.requestedBy" />, cell: (r) => r.requestedBy },
    { key: "name", header: <Bi id="items.nameEn" />, cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: "nameUr", header: <Bi id="items.nameUr" />, cell: (r) => <span lang="ur" dir="rtl">{r.nameUr}</span> },
    { key: "category", header: <Bi id="filter.category" />, cell: (r) => r.category, sortValue: (r) => r.category },
    { key: "unit", header: <Bi id="line.unit" />, cell: (r) => t(`unit.${r.unit}`).en },
  ];
  const pending = requests.data ?? [];

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
      <div role="tablist" className="flex gap-2">
        {([false, true] as const).map((requested) => (
          <button
            key={String(requested)}
            type="button"
            role="tab"
            aria-selected={showRequested === requested}
            className={clsx("btn min-h-10", showRequested === requested && "btn-primary", requested && pending.length > 0 && showRequested !== requested && "border-warning bg-warning-bg")}
            onClick={() => router.replace(requested ? `${pathname}?show=requested` : pathname)}
          >
            {requested ? <Bi id="items.showRequested" values={{ n: String(pending.length) }} inline /> : <Bi id="items.showItems" inline />}
          </button>
        ))}
      </div>
      {showRequested ? (
        requests.isError ? (
          <LoadError onRetry={() => requests.refetch()} />
        ) : !requests.data ? (
          <SkeletonRows rows={4} />
        ) : pending.length === 0 ? (
          <p className="card p-4 text-muted">
            <Bi id="items.noRequests" />
          </p>
        ) : (
          <DataTable rows={pending} columns={requestColumns} rowKey={(r) => r.id} onOpen={(r) => setDraft(fromRequest(r))} initialSort={{ key: "at", dir: "desc" }} />
        )
      ) : (
        <>
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
        </>
      )}
      {draft && <ItemDrawer key={draft.requestId ?? draft.id ?? "new"} initial={draft} categories={categories} onClose={() => setDraft(null)} />}
    </div>
  );
}

function ItemDrawer({ initial, categories, onClose }: { initial: Draft; categories: string[]; onClose: () => void }) {
  const titleId = useId();
  const listId = useId();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<MsgId | null>(null);
  const save = useApiMutation(api.saveItem);
  const approve = useApiMutation(api.approveItemRequest);
  const reject = useApiMutation(api.rejectItemRequest);
  const [rejectNote, setRejectNote] = useState("");
  const busy = save.isPending || approve.isPending || reject.isPending;
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
          <Bi id={d.requestId ? "items.reviewRequest" : d.id ? "items.edit" : "items.add"} />
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
            const { requestId, ...item } = d;
            if (requestId) await approve.mutateAsync({ requestId, item: { ...item, aliases: d.aliases.split(",") } });
            else await save.mutateAsync({ ...item, aliases: d.aliases.split(","), by: "Accounts Admin" });
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
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Bi id={d.requestId ? "items.approve" : "slip.save"} inline />
        </button>
      </form>
      {d.requestId && (
        <form
          className="flex flex-col gap-2 border-t border-line pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await reject.mutateAsync({ requestId: d.requestId!, note: rejectNote });
              onClose();
            } catch (err) {
              setError(err instanceof ApiError ? err.id : "err.notSaved");
            }
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="items.rejectNote" />
            <input className="input" dir="auto" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          </label>
          <button type="submit" className="btn text-danger" disabled={busy}>
            <Bi id="items.reject" inline />
          </button>
        </form>
      )}
    </aside>
  );
}
