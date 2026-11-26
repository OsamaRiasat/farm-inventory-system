"use client";

import { Undo2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { QtyInput } from "@/components/slip/qty-input";
import { newIdempotencyKey } from "@/features/form-data";
import { returnable, returnSchema, type ReturnableLine } from "@/features/sis/return-schema";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useStock } from "@/lib/api/queries";
import { today } from "@/lib/dates";
import { fmtQty, parseQty } from "@/lib/format";
import { t, type MsgId, type MsgValues } from "@/lib/i18n";
import { enterToNext } from "@/lib/keyboard/focus";
import { REMARKS_MAX, toFieldErrors } from "@/lib/validation";
import { slipNo } from "@/lib/slips";
import type { Item, SIS } from "@/types/domain";

type Err = { id: MsgId; values?: MsgValues };
type Props = { slip: SIS; items: Map<string, Item>; lines: ReturnableLine[]; onSaved: () => void };

/** F7 — the Farm User brings unused items back from their own SIS. */
export function FarmReturnUnused(props: Props) {
  const { userName } = useCurrentFarm();
  return <ReturnUnusedDialog {...props} by={userName} />;
}

/**
 * F7 / A3 "Return unused": items issued on a saved SIS but not used come back into stock.
 * Qty returned per line (≤ issued − already returned), return date, optional remarks.
 * Keyboard: Enter → next box, Ctrl/⌘+S or Ctrl/⌘+Enter → save, Esc closes.
 */
export function ReturnUnusedDialog({ slip, items, lines, by, onSaved }: Props & { by: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const stock = useStock(slip.farmId).data;
  const [qtys, setQtys] = useState<string[]>(() => lines.map(() => ""));
  const [date, setDate] = useState(today);
  const [remarks, setRemarks] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<number, Err>>({});
  const [error, setError] = useState<Err | null>(null);
  const key = useRef(newIdempotencyKey());
  const mutation = useApiMutation(api.returnUnused);

  if (!lines.some((l) => returnable(l) > 0)) return null;

  function open() {
    setQtys(lines.map(() => ""));
    setDate(today());
    setRemarks("");
    setLineErrors({});
    setError(null);
    key.current = newIdempotencyKey();
    dialogRef.current?.showModal();
    // autoFocus does nothing in a <dialog> opened later.
    formRef.current?.querySelector<HTMLInputElement>("input[name^='lines.']")?.focus();
  }

  async function save() {
    if (mutation.isPending) return;
    const picked = qtys.flatMap((q, lineIndex) => {
      const qty = parseQty(q);
      return q.trim() && qty !== null ? [{ lineIndex, qty }] : q.trim() ? [{ lineIndex, qty: NaN }] : [];
    });
    const input = { sisId: slip.id, date, by, remarks: remarks.trim() || undefined, idempotencyKey: key.current, lines: picked };
    const rules = { item: (id: string) => items.get(id), stockOf: (id: string) => stock?.get(id) ?? 0, today: today() };
    const result = returnSchema(rules, { date: slip.date, lines }).safeParse(input);
    if (!result.success) return showErrors(toFieldErrors(result.error), picked);
    try {
      await mutation.mutateAsync(input);
      dialogRef.current?.close();
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors?.length) return showErrors(e.fieldErrors, picked);
      setError(e instanceof ApiError ? { id: e.id, values: e.values } : { id: "err.notSaved" });
    }
  }

  function showErrors(errors: { path: (string | number)[]; id: MsgId; values?: MsgValues }[], picked: { lineIndex: number }[]) {
    const byLine: Record<number, Err> = {};
    let other: Err | null = null;
    for (const e of errors) {
      const sent = e.path[0] === "lines" && typeof e.path[1] === "number" ? picked[e.path[1]] : undefined;
      if (sent) byLine[sent.lineIndex] ??= { id: e.id, values: e.values };
      else other ??= { id: e.id, values: e.values };
    }
    setLineErrors(byLine);
    setError(other);
  }

  return (
    <>
      <button type="button" className="btn" onClick={open}>
        <Undo2 size={18} aria-hidden />
        <Bi id="ret.button" inline />
      </button>
      <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
        <form
          ref={formRef}
          className="flex flex-col gap-3 p-4"
          autoComplete="off"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "s" || e.key === "Enter")) {
              e.preventDefault();
              void save();
              return;
            }
            enterToNext(e);
          }}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 id={titleId} className="text-lg font-semibold">
            <Bi id="ret.title" values={{ no: slipNo(slip) }} />
          </h2>
          <p className="text-sm text-muted">
            <Bi id="ret.hint" />
          </p>

          <ul className="flex flex-col gap-3">
            {lines.map((l, i) => {
              const item = items.get(l.itemId);
              const unit = item ? t(`unit.${item.unit}`).en : "";
              const left = returnable(l);
              const qty = parseQty(qtys[i]);
              const onHand = stock?.get(l.itemId);
              const lineError = lineErrors[i];
              return (
                <li key={i} className="flex flex-col gap-1 rounded-lg border border-line p-3" data-return-line={i}>
                  <span className="font-medium">
                    {i + 1}. {item?.name}
                    {item?.nameUr && (
                      <span lang="ur" dir="rtl" className="ml-2">
                        {item.nameUr}
                      </span>
                    )}
                  </span>
                  <span className="num flex flex-wrap gap-x-3 text-sm text-muted">
                    <span>
                      <Bi id="ret.issued" inline /> {fmtQty(l.issued)} {unit}
                    </span>
                    {l.returned > 0 && (
                      <span>
                        <Bi id="ret.returned" inline /> {fmtQty(l.returned)} {unit}
                      </span>
                    )}
                  </span>
                  {left > 0 ? (
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      <span className="flex flex-wrap justify-between gap-2">
                        <Bi id="ret.qty" inline />
                        <span className="num font-normal text-muted">
                          <Bi id="ret.left" values={{ n: `${fmtQty(left)} ${unit}` }} inline />
                        </span>
                      </span>
                      <QtyInput
                        name={`lines.${i}.qty`}
                        value={qtys[i]}
                        onChange={(v) => {
                          setQtys((prev) => prev.map((x, j) => (j === i ? v : x)));
                          setLineErrors((prev) => {
                            const next = { ...prev };
                            delete next[i];
                            return next;
                          });
                          setError(null);
                        }}
                        suffix={unit || undefined}
                        invalid={!!lineError}
                      />
                      {qty !== null && qty > 0 && onHand !== undefined && !lineError && (
                        <span className="num font-normal text-muted">
                          <Bi id="ret.stockAfter" values={{ from: fmtQty(onHand), to: `${fmtQty(onHand + qty)} ${unit}` }} inline />
                        </span>
                      )}
                      {lineError && (
                        <span role="alert" className="text-danger">
                          <Bi id={lineError.id} values={lineError.values} inline />
                        </span>
                      )}
                    </label>
                  ) : (
                    <span className="text-sm text-muted">
                      <Bi id="ret.left" values={{ n: "0" }} inline />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="ret.date" />
            <input
              type="date"
              name="date"
              className="input num min-h-10 w-auto"
              value={date}
              min={slip.date}
              max={today()}
              onChange={(e) => {
                setDate(e.target.value);
                setError(null);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="slip.remarks" />
            <input
              name="remarks"
              dir="auto"
              className="input"
              maxLength={REMARKS_MAX}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              <Bi id={error.id} values={error.values} inline />
            </p>
          )}
          <p className="hidden text-xs text-muted md:block">
            <Bi id="ret.keys" inline />
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              <Bi id="common.close" inline />
            </button>
            <button type="submit" className="btn btn-primary" data-save disabled={mutation.isPending}>
              <Bi id="ret.save" inline />
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
