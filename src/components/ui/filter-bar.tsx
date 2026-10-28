"use client";

import { X } from "lucide-react";
import { Bi } from "@/components/layout/bi";
import { ItemPicker } from "@/components/slip/item-picker";
import { useItemMap, useItems } from "@/lib/api/queries";
import { tInline } from "@/lib/i18n";
import type { Farm, SlipStatus, SlipType } from "@/types/domain";
import { FarmPicker } from "./farm-picker";

export type Filters = {
  farmId?: string;
  from?: string;
  to?: string;
  type?: SlipType;
  itemId?: string;
  no?: string;
  status?: SlipStatus;
  category?: string;
};
type Field = "no" | "farm" | "dates" | "type" | "item" | "status" | "category";

/** C11 filter bar: the same filters on every admin list and report. "/" focuses the No. search. */
export function FilterBar({
  value,
  onChange,
  fields = ["no", "farm", "dates", "type", "item"],
  farms,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  fields?: Field[];
  farms?: Farm[];
}) {
  const items = useItemMap();
  const categories = [...new Set((useItems().data ?? []).map((i) => i.category))].sort();
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const has = (f: Field) => fields.includes(f);
  const active = fields.some((f) => {
    const keys: Record<Field, (keyof Filters)[]> = { no: ["no"], farm: ["farmId"], dates: ["from", "to"], type: ["type"], item: ["itemId"], status: ["status"], category: ["category"] };
    return keys[f].some((k) => value[k]);
  });

  return (
    <div className="card flex flex-wrap items-end gap-3 p-3 text-sm">
      {has("no") && (
        <label className="flex w-40 flex-col gap-1">
          <Bi id="filter.no" />
          <input
            type="search"
            data-search
            className="input min-h-10"
            value={value.no ?? ""}
            onChange={(e) => set({ no: e.target.value || undefined })}
            placeholder="AW02-IGP-…"
          />
        </label>
      )}
      {has("farm") && (
        <label className="flex w-56 flex-col gap-1">
          <Bi id="filter.farm" />
          <FarmPicker farms={farms ?? []} includeAll value={value.farmId ?? ""} onChange={(farmId) => set({ farmId: farmId || undefined })} className="input min-h-10" />
        </label>
      )}
      {has("dates") && (
        <>
          <label className="flex flex-col gap-1">
            <Bi id="filter.from" />
            <input type="date" className="input num min-h-10" value={value.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
          </label>
          <label className="flex flex-col gap-1">
            <Bi id="filter.to" />
            <input type="date" className="input num min-h-10" value={value.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
          </label>
        </>
      )}
      {has("type") && (
        <label className="flex w-36 flex-col gap-1">
          <Bi id="filter.type" />
          <select className="input min-h-10" value={value.type ?? ""} onChange={(e) => set({ type: (e.target.value || undefined) as SlipType | undefined })}>
            <option value="">{tInline("filter.allTypes")}</option>
            <option value="IGP">IGP</option>
            <option value="OGP">OGP</option>
            <option value="SIS">SIS</option>
          </select>
        </label>
      )}
      {has("status") && (
        <label className="flex w-40 flex-col gap-1">
          <Bi id="filter.status" />
          <select
            className="input min-h-10"
            value={value.status ?? ""}
            onChange={(e) => set({ status: (e.target.value || undefined) as SlipStatus | undefined })}
          >
            <option value="">{tInline("filter.allStatuses")}</option>
            <option value="saved">{tInline("status.saved")}</option>
            <option value="corrected">{tInline("status.corrected")}</option>
            <option value="cancelled">{tInline("status.cancelled")}</option>
          </select>
        </label>
      )}
      {has("category") && (
        <label className="flex w-48 flex-col gap-1">
          <Bi id="filter.category" />
          <select className="input min-h-10" value={value.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })}>
            <option value="">{tInline("stock.allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {has("item") && (
        <div className="flex w-64 flex-col gap-1">
          <Bi id="filter.item" />
          <ItemPicker
            key={value.itemId ? "set" : "empty"}
            name="filterItem"
            item={value.itemId ? (items.get(value.itemId) ?? null) : null}
            onPick={(item) => set({ itemId: item?.id })}
          />
        </div>
      )}
      {active && (
        <button type="button" className="btn min-h-10" onClick={() => onChange({ farmId: has("farm") ? undefined : value.farmId })}>
          <X size={16} aria-hidden />
          <Bi id="filter.clear" inline />
        </button>
      )}
    </div>
  );
}
