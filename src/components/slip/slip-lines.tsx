"use client";

import { clsx } from "clsx";
import { Plus, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { useItemMap, useStock } from "@/lib/api/queries";
import { allowsDecimals, fmtQty, parseQty } from "@/lib/format";
import { t, tInline, type MsgId } from "@/lib/i18n";
import type { Item } from "@/types/domain";
import { ItemPicker } from "./item-picker";
import { rowErrors, useSlipErrors } from "./slip-errors";
import { QtyInput } from "./qty-input";

export type LineCol = {
  /** Form field key; quantity rules look for "qty", "qtyChallan" and "qtyReceived". */
  key: string;
  label: MsgId;
  kind: "item" | "unit" | "qty" | "weight" | "text" | "folio";
  /** Grid track on tablet/desktop, e.g. "2fr" or "6rem". */
  width: string;
  required?: boolean;
  readOnly?: boolean;
};

export type LineRules = {
  /** Qty Actual Received below challan → amber "Short by n" (still saveable). */
  shortfall?: boolean;
  /** Qty Actual Received above qty sent → blocked. */
  maxSent?: boolean;
  /** Qty above the farm's stock → blocked. */
  maxStock?: boolean;
};

type Row = { id: number; itemId: string; values: Record<string, string> };

type Props = {
  cols: LineCol[];
  title?: MsgId;
  initial?: { itemId: string; values: Record<string, string> }[];
  /** Lines come from another slip (receive transfer): no add / remove. */
  fixed?: boolean;
  showStock?: boolean;
  rules?: LineRules;
  receivedAll?: boolean;
};

const EDITABLE = new Set<LineCol["kind"]>(["item", "qty", "weight", "text"]);

/**
 * C3 slip lines: card per line on phone, table row from 640px.
 * Keys: Enter on a line's last field adds a line; Enter in an empty new line jumps to Save;
 * Alt+N adds, Alt+Backspace removes.
 */
export function SlipLines({ cols, title = "line.items", initial, fixed, showStock, rules = {}, receivedAll }: Props) {
  const uid = useId();
  const { farm } = useCurrentFarm();
  const saveErrors = useSlipErrors();
  const items = useItemMap();
  const stock = useStock(showStock || rules.maxStock ? farm.id : undefined).data;
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.length ? initial.map((r, i) => ({ id: i + 1, ...r })) : [{ id: 1, itemId: "", values: {} }],
  );
  const nextId = useRef(rows.length + 1);
  const focusRowId = useRef<number | null>(null);

  useEffect(() => {
    if (focusRowId.current === null) return;
    document.querySelector<HTMLElement>(`[data-row="${uid}-${focusRowId.current}"] [data-kind="item"]`)?.focus();
    focusRowId.current = null;
  }, [rows, uid]);

  const lastEditable = [...cols].reverse().find((c) => EDITABLE.has(c.kind) && !c.readOnly)?.key;
  const gridCols = ["2.5rem", ...cols.map((c) => c.width), ...(fixed ? [] : ["2.5rem"])].join(" ");

  function addLine() {
    const id = nextId.current++;
    focusRowId.current = id;
    setRows((rs) => [...rs, { id, itemId: "", values: {} }]);
  }

  function removeLine(index: number) {
    if (rows.length === 1) return;
    focusRowId.current = rows[index - 1]?.id ?? rows[index + 1].id;
    setRows((rs) => rs.filter((_, i) => i !== index));
  }

  function update(id: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function setValue(row: Row, key: string, value: string) {
    update(row.id, { values: { ...row.values, [key]: value } });
  }

  function onRowKeyDown(e: KeyboardEvent<HTMLLIElement>, index: number) {
    if (e.defaultPrevented) return;
    if (!fixed && e.altKey && e.code === "KeyN") {
      e.preventDefault();
      addLine();
      return;
    }
    if (!fixed && e.altKey && e.key === "Backspace") {
      e.preventDefault();
      removeLine(index);
      return;
    }
    if (fixed || e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLInputElement;
    const isLast = index === rows.length - 1;
    if (isLast && target.dataset.lineLast !== undefined) {
      e.preventDefault();
      addLine();
    } else if (isLast && index > 0 && target.dataset.kind === "item" && !target.value) {
      e.preventDefault();
      document.querySelector<HTMLElement>("[data-save]")?.focus();
    }
  }

  function fillReceivedAll() {
    setRows((rs) => rs.map((r) => ({ ...r, values: { ...r.values, qtyReceived: r.values.qtyChallan ?? "" } })));
  }

  return (
    <section className="card mb-4 p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-semibold">
          <Bi id={title} />
        </h2>
        {receivedAll && (
          <button type="button" className="btn" onClick={fillReceivedAll}>
            <Bi id="line.receivedAll" inline />
          </button>
        )}
      </div>

      <div style={{ "--line-cols": gridCols } as CSSProperties}>
        <div className="hidden gap-2 border-b border-line px-2 pb-2 text-xs text-muted sm:grid sm:[grid-template-columns:var(--line-cols)]">
          <Bi id="line.srNo" />
          {cols.map((c) => (
            <span key={c.key} className={clsx("flex gap-1", (c.kind === "qty" || c.kind === "weight") && "justify-end")}>
              <Bi id={c.label} />
              {c.required && !c.readOnly && (
                <span className="text-danger" aria-hidden>
                  *
                </span>
              )}
            </span>
          ))}
        </div>

        <ol className="flex flex-col gap-3 sm:gap-0">
          {rows.map((row, index) => {
            const item = items.get(row.itemId) ?? null;
            // Same item on several lines: the stock rule counts them together, like the save does.
            const usedBefore = rows
              .slice(0, index)
              .filter((r) => r.itemId === row.itemId)
              .reduce((sum, r) => sum + (parseQty(r.values.qty ?? "") ?? 0), 0);
            const available = item && stock ? (stock.get(item.id) ?? 0) - usedBefore : null;
            const check = checkRow(row, available, rules);
            // Errors from the last save that the live checks didn't already show.
            const fromSave = rowErrors(saveErrors, "lines", index);
            for (const key of fromSave.keys) check.invalid.add(key);
            for (const e of fromSave.errors) {
              if (!check.messages.some((m) => m.id === e.id)) {
                check.messages.push({ id: e.id, error: true, node: <Bi id={e.id} values={e.values} /> });
              }
            }
            return (
              <li
                key={row.id}
                data-row={`${uid}-${row.id}`}
                onKeyDown={(e) => onRowKeyDown(e, index)}
                className={clsx(
                  "relative grid grid-cols-2 items-end gap-x-3 gap-y-2 rounded-lg border border-line p-3",
                  "sm:items-start sm:gap-2 sm:rounded-none sm:border-0 sm:border-b sm:px-2 sm:[grid-template-columns:var(--line-cols)]",
                  check.warn && "bg-warning-bg",
                )}
              >
                <div className="num col-span-2 font-semibold sm:col-span-1 sm:pt-3">{index + 1}</div>
                {cols.map((c) => (
                  <Cell
                    key={c.key}
                    col={c}
                    row={row}
                    item={item}
                    name={`lines.${index}.${c.key}`}
                    labelId={`${uid}-${row.id}-${c.key}`}
                    isLast={c.key === lastEditable}
                    invalid={check.invalid.has(c.key)}
                    farmId={farm.id}
                    stock={showStock ? stock : undefined}
                    onItem={(picked) => update(row.id, { itemId: picked?.id ?? "" })}
                    onValue={(v) => setValue(row, c.key, v)}
                  />
                ))}
                {!fixed && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={tInline("line.remove")}
                    title={tInline("line.remove")}
                    disabled={rows.length === 1}
                    onClick={() => removeLine(index)}
                    className="absolute top-1 right-1 flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30 sm:static sm:mt-1"
                  >
                    <X size={20} aria-hidden />
                  </button>
                )}
                {check.messages.length > 0 && (
                  <div className="col-span-full flex flex-col gap-1">
                    {check.messages.map((m, i) => (
                      <p key={i} className={clsx("flex items-start gap-1 text-sm font-medium", m.error ? "text-danger" : "text-warning")}>
                        <TriangleAlert size={16} className="mt-1 shrink-0" aria-hidden />
                        {m.node}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {!fixed && (
        <button type="button" className="btn mt-3 w-full border-dashed text-primary" onClick={addLine}>
          <Plus size={20} aria-hidden />
          <Bi id="line.add" inline />
        </button>
      )}
      {!fixed && (
        <p className="mt-2 hidden text-xs text-muted lg:block">
          <Bi id="line.keys" />
        </p>
      )}
    </section>
  );
}

function Cell({
  col,
  row,
  item,
  name,
  labelId,
  isLast,
  invalid,
  farmId,
  stock,
  onItem,
  onValue,
}: {
  col: LineCol;
  row: Row;
  item: Item | null;
  name: string;
  labelId: string;
  isLast: boolean;
  invalid: boolean;
  farmId: string;
  stock?: Map<string, number>;
  onItem: (item: Item | null) => void;
  onValue: (value: string) => void;
}) {
  const phoneLabel = (
    <span id={labelId} className="mb-1 block text-sm font-medium sm:hidden">
      <Bi id={col.label} />
    </span>
  );
  const value = row.values[col.key] ?? "";
  const lastProps = isLast ? { "data-line-last": "" } : {};

  switch (col.kind) {
    case "item":
      return (
        <div className="col-span-2 sm:col-span-1">
          {phoneLabel}
          {col.readOnly ? (
            <div className="sm:pt-3" aria-labelledby={labelId}>
              <div className="font-medium">{item?.name}</div>
              <div lang="ur" dir="rtl" className="text-left text-sm text-muted">
                {item?.nameUr}
              </div>
              <input type="hidden" name={name} value={row.itemId} />
            </div>
          ) : (
            <ItemPicker name={name} item={item} onPick={onItem} farmId={farmId} stock={stock} labelledBy={labelId} />
          )}
        </div>
      );
    case "unit":
      return <div className="hidden pt-3 sm:block">{item ? <Bi id={`unit.${item.unit}`} /> : "—"}</div>;
    case "folio":
      return (
        <div>
          {phoneLabel}
          <div className="num min-h-12 pt-3 text-muted sm:text-right">{item?.number ?? "—"}</div>
        </div>
      );
    case "qty":
      return (
        <div>
          {phoneLabel}
          <QtyInput
            name={name}
            value={value}
            onChange={onValue}
            suffix={item ? t(`unit.${item.unit}`).en : undefined}
            decimals={item ? allowsDecimals(item.unit) : true}
            readOnly={col.readOnly}
            tabIndex={col.readOnly ? -1 : undefined}
            required={col.required && !col.readOnly}
            invalid={invalid}
            aria-labelledby={labelId}
            {...lastProps}
          />
        </div>
      );
    case "weight":
      return (
        <div>
          {phoneLabel}
          <QtyInput name={name} value={value} onChange={onValue} suffix="kg" decimals aria-labelledby={labelId} {...lastProps} />
        </div>
      );
    case "text":
      return (
        <div className="col-span-2 sm:col-span-1">
          {phoneLabel}
          <input
            type="text"
            name={name}
            dir="auto"
            autoComplete="off"
            enterKeyHint="next"
            className="input"
            value={value}
            onChange={(e) => onValue(e.target.value)}
            aria-labelledby={labelId}
            {...lastProps}
          />
        </div>
      );
  }
}

type Check = { warn: boolean; invalid: Set<string>; messages: { id: MsgId; error: boolean; node: ReactNode }[] };

/** Live line checks with the same message ids as the save rules in each feature's schema.ts. */
function checkRow(row: Row, available: number | null, rules: LineRules): Check {
  const check: Check = { warn: false, invalid: new Set(), messages: [] };
  const challan = parseQty(row.values.qtyChallan ?? "");
  const received = parseQty(row.values.qtyReceived ?? "");
  const qty = parseQty(row.values.qty ?? "");

  if (rules.maxSent && challan !== null && received !== null && received > challan) {
    check.invalid.add("qtyReceived");
    check.messages.push({ id: "err.cannotReceiveMore", error: true, node: <Bi id="err.cannotReceiveMore" values={{ n: fmtQty(challan) }} /> });
  } else if (rules.shortfall && challan !== null && received !== null && received < challan) {
    check.warn = true;
    check.messages.push({ id: "msg.shortBy", error: false, node: <Bi id="msg.shortBy" values={{ n: fmtQty(challan - received) }} /> });
  }
  if (rules.maxStock && available !== null && qty !== null && qty > available) {
    check.invalid.add("qty");
    check.messages.push({ id: "err.onlyInStock", error: true, node: <Bi id="err.onlyInStock" values={{ n: fmtQty(Math.max(available, 0)) }} /> });
  }
  return check;
}
