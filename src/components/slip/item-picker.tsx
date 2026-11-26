"use client";

import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { useItemMap, useItemSearch } from "@/lib/api/queries";
import { fmtQty } from "@/lib/format";
import { t, tInline } from "@/lib/i18n";
import { recentItemIds, rememberItem } from "@/lib/recent-items";
import type { Item, ItemRequest } from "@/types/domain";
import { Combobox } from "./combobox";
import { RequestItemDialog } from "./request-item-dialog";

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
  allowRequest,
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
  /** Farm User: "+" and Enter on "No item found" open Request a new item (client #30). */
  allowRequest?: boolean;
}) {
  const search = useItemSearch();
  const items = useItemMap();
  const allowed = (i: Item) => !filter || filter(i);
  const boxRef = useRef<HTMLDivElement>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [sent, setSent] = useState<ItemRequest | null>(null);
  const searchInput = () => boxRef.current?.querySelector<HTMLInputElement>("[data-kind]");
  // Back to item search once the dialog is gone (while it is open the page behind it can't take focus).
  const refocus = useRef(false);
  useEffect(() => {
    if (requesting !== null || !refocus.current) return;
    refocus.current = false;
    searchInput()?.focus();
  }, [requesting]);

  return (
    <div ref={boxRef}>
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
        noResults={
          <span className="flex flex-col gap-1">
            <Bi id="line.noMatch" inline />
            {allowRequest && (
              <span className="text-sm text-primary">
                <Bi id="itemReq.noMatchHint" inline />
              </span>
            )}
          </span>
        }
        onNoMatch={allowRequest ? (text) => setRequesting(text) : undefined}
        after={
          allowRequest && (
            <button
              type="button"
              tabIndex={-1}
              className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line-strong text-primary hover:bg-surface-2 md:size-10"
              aria-label={tInline("itemReq.button")}
              title={tInline("itemReq.button")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setRequesting(searchInput()?.value.trim() ?? "")}
            >
              <Plus size={20} aria-hidden />
            </button>
          )
        }
        openOnFocus
        sheetOnPhone
        getKey={(i) => i.id}
        getText={(i) => i.name}
        onPick={(picked) => {
          if (picked) setSent(null);
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
              {i.nameUr ? (
                <div lang="ur" dir="rtl" className="text-left">
                  {i.nameUr}
                </div>
              ) : (
                <div className="text-sm text-muted">{i.category}</div>
              )}
            </div>
            {stock && <StockNote item={i} qty={stock.get(i.id) ?? 0} stacked />}
          </div>
        )}
      />
      <input type="hidden" name={name} value={item?.id ?? ""} />
      {requesting !== null && (
        <RequestItemDialog
          name={requesting}
          onClose={(done) => {
            refocus.current = true;
            setRequesting(null);
            if (done) setSent(done);
          }}
        />
      )}
      {sent && !item && (
        <p role="status" className="mt-1 text-sm font-medium text-primary">
          <Bi id="itemReq.sent" values={{ name: sent.name }} inline />
        </p>
      )}
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
