"use client";

import { clsx } from "clsx";
import { Bi } from "@/components/layout/bi";
import { useItemMap, useItemSearch } from "@/lib/api/queries";
import { fmtQty } from "@/lib/format";
import { t, tInline } from "@/lib/i18n";
import { recentItemIds, rememberItem } from "@/lib/recent-items";
import type { Item } from "@/types/domain";
import { Combobox } from "./combobox";

/**
 * C1 item search: English name, Urdu name, alias or item number, mixed input ("belt 89A", "فین بیلٹ"),
 * spelling variants via fuzzy match. Recent items first. Full-screen sheet on phone, dropdown on desktop.
 */
export function ItemPicker({
  name,
  item,
  onPick,
  farmId,
  stock,
  filter,
  labelledBy,
}: {
  name: string;
  item: Item | null;
  onPick: (item: Item | null) => void;
  /** Recent items are remembered per farm. */
  farmId?: string;
  /** When given, every result shows "In stock". */
  stock?: Map<string, number>;
  /** Limit the choice, e.g. feed items only. */
  filter?: (item: Item) => boolean;
  labelledBy?: string;
}) {
  const search = useItemSearch();
  const items = useItemMap();
  const allowed = (i: Item) => !filter || filter(i);

  return (
    <div>
      <Combobox
        search={(q) => search(q, 20).filter(allowed)}
        initialOptions={() =>
          farmId
            ? recentItemIds(farmId)
                .map((id) => items.get(id))
                .filter((i): i is Item => !!i && allowed(i))
            : []
        }
        initialHeading={<Bi id="line.recent" inline />}
        noResults={<Bi id="line.noMatch" inline />}
        openOnFocus
        sheetOnPhone
        getKey={(i) => i.id}
        getText={(i) => i.name}
        onPick={(picked) => {
          if (picked && farmId) rememberItem(farmId, picked.id);
          onPick(picked);
        }}
        defaultText={item?.name}
        kind="item"
        inputProps={{ "aria-labelledby": labelledBy, placeholder: tInline("line.searchHint") }}
        renderOption={(i) => (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{i.name}</div>
              <div lang="ur" dir="rtl" className="text-left">
                {i.nameUr}
              </div>
            </div>
            {stock && <StockNote item={i} qty={stock.get(i.id) ?? 0} stacked />}
          </div>
        )}
      />
      <input type="hidden" name={name} value={item?.id ?? ""} />
      {item && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
          <span lang="ur" dir="rtl">
            {item.nameUr}
          </span>
          {stock && <StockNote item={item} qty={stock.get(item.id) ?? 0} />}
        </div>
      )}
    </div>
  );
}

function StockNote({ item, qty, stacked }: { item: Item; qty: number; stacked?: boolean }) {
  return (
    <span className={clsx("num shrink-0 text-sm whitespace-nowrap", stacked && "text-right", qty > 0 ? "text-muted" : "text-danger")}>
      <Bi id="line.inStock" values={{ n: fmtQty(qty), unit: t(`unit.${item.unit}`).en }} inline={!stacked} className={clsx(stacked && "items-end")} />
    </span>
  );
}
