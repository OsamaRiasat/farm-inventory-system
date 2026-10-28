"use client";

import { PencilLine } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { QtyInput } from "@/components/slip/qty-input";
import { api, ApiError } from "@/lib/api";
import { useApiMutation } from "@/lib/api/queries";
import { allowsDecimals, fmtQty, parseQty } from "@/lib/format";
import { t, type MsgId } from "@/lib/i18n";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import type { Item, Slip } from "@/types/domain";
import { lineQty } from "./util";

/** F7 — the Farm User can't change a saved slip; they ask the Accounts Admin, with the right quantity and a reason. */
export function RequestCorrectionDialog({ slip, items, onSent }: { slip: Slip; items: Map<string, Item>; onSent: () => void }) {
  const { userName } = useCurrentFarm();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [line, setLine] = useState(0);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<MsgId | null>(null);
  const mutation = useApiMutation(api.requestCorrection);

  if (slip.lines.length === 0) return null;
  const item = items.get(slip.lines[line]?.itemId ?? "");

  async function send() {
    const requestedQty = parseQty(qty);
    if (requestedQty === null) return setError("err.qtyAboveZero");
    if (!reason.trim()) return setError("err.enterReason");
    try {
      await mutation.mutateAsync({ slipId: slip.id, lineIndex: line, requestedQty, reason, requestedBy: userName });
      dialogRef.current?.close();
      setQty("");
      setReason("");
      onSent();
    } catch (e) {
      setError(e instanceof ApiError ? e.id : "err.notSaved");
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => dialogRef.current?.showModal()}>
        <PencilLine size={18} aria-hidden />
        <Bi id="detail.requestCorrection" inline />
      </button>
      <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
        <form
          method="dialog"
          className="flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <h2 id={titleId} className="text-lg font-semibold">
            <Bi id="detail.requestCorrection" />
          </h2>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="detail.line" />
            <select className="input" value={line} onChange={(e) => setLine(Number(e.target.value))} autoFocus>
              {slip.lines.map((l, i) => (
                <option key={i} value={i}>
                  {i + 1}. {items.get(l.itemId)?.name} — {fmtQty(lineQty(slip, i))}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="detail.newQty" />
            <QtyInput
              value={qty}
              onChange={(v) => {
                setQty(v);
                setError(null);
              }}
              suffix={item ? t(`unit.${item.unit}`).en : undefined}
              decimals={item ? allowsDecimals(item.unit) : true}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="detail.reason" />
            <textarea
              dir="auto"
              rows={2}
              className="input py-2"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              <Bi id={error} inline />
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              <Bi id="common.close" inline />
            </button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              <Bi id="detail.send" inline />
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
