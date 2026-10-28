"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { QtyInput } from "@/components/slip/qty-input";
import { api, ApiError } from "@/lib/api";
import { useApiMutation } from "@/lib/api/queries";
import { allowsDecimals, fmtQty, parseQty } from "@/lib/format";
import { t, type MsgId, type MsgValues } from "@/lib/i18n";
import { enterToNext } from "@/lib/keyboard/focus";
import type { CorrectionRequest, Item, Slip } from "@/types/domain";
import { lineQty } from "./util";

const ADMIN = "Accounts Admin";

/**
 * A3 Correct: the slip's lines with editable quantities and a required reason, showing before → after.
 * Saving creates a correction slip; the original stays visible, marked corrected. Opened from A6 it is pre-filled.
 */
export function CorrectPanel({
  slip,
  items,
  request,
  onClose,
  onSaved,
}: {
  slip: Slip;
  items: Map<string, Item>;
  request?: CorrectionRequest;
  onClose: () => void;
  onSaved: (no: string) => void;
}) {
  const [values, setValues] = useState(() =>
    slip.lines.map((_, i) => fmtQty(request && request.lineIndex === i ? request.requestedQty : lineQty(slip, i))),
  );
  const [reason, setReason] = useState(request?.reason ?? "");
  const [error, setError] = useState<{ id: MsgId; values?: MsgValues } | null>(null);
  const mutation = useApiMutation(api.correctSlip);

  const changes = slip.lines.flatMap((_, i) => {
    const next = parseQty(values[i]);
    return next !== null && next !== lineQty(slip, i) ? [{ index: i, qty: next }] : [];
  });

  async function save() {
    if (changes.length === 0) return setError({ id: "detail.noChange" });
    if (!reason.trim()) return setError({ id: "err.enterReason" });
    try {
      const corrected = await mutation.mutateAsync({ slipId: slip.id, lines: changes, reason, by: ADMIN, requestId: request?.id });
      onSaved(corrected.no);
    } catch (e) {
      setError(e instanceof ApiError ? { id: e.id, values: e.values } : { id: "err.notSaved" });
    }
  }

  return (
    <form
      className="card flex flex-col gap-3 border-sis p-4"
      onKeyDown={enterToNext}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className="font-semibold">
        <Bi id="detail.correct" />
      </h2>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>
                <Bi id="line.srNo" />
              </th>
              <th>
                <Bi id="line.item" />
              </th>
              <th className="text-right">
                <Bi id="detail.currentQty" />
              </th>
              <th className="text-right">
                <Bi id="detail.newQty" />
              </th>
              <th className="text-right">
                <Bi id="detail.difference" />
              </th>
            </tr>
          </thead>
          <tbody>
            {slip.lines.map((l, i) => {
              const item = items.get(l.itemId);
              const before = lineQty(slip, i);
              const next = parseQty(values[i]);
              const diff = next === null ? 0 : next - before;
              return (
                <tr key={i} className={clsx(diff !== 0 && "bg-primary-soft")}>
                  <td className="num">{i + 1}</td>
                  <td>{item?.name}</td>
                  <td className="num text-right">{fmtQty(before)}</td>
                  <td className="w-40">
                    <QtyInput
                      value={values[i]}
                      onChange={(v) => {
                        setValues((vs) => vs.map((x, k) => (k === i ? v : x)));
                        setError(null);
                      }}
                      suffix={item ? t(`unit.${item.unit}`).en : undefined}
                      decimals={item ? allowsDecimals(item.unit) : true}
                      autoFocus={i === (request?.lineIndex ?? 0)}
                      aria-label={`${i + 1}. ${item?.name ?? ""}`}
                    />
                  </td>
                  <td className="num text-right font-semibold">{diff === 0 ? "" : `${diff > 0 ? "+" : ""}${fmtQty(diff)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        <Bi id="detail.reason" />
        <input dir="auto" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          <Bi id={error.id} values={error.values} inline />
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" className="btn" onClick={onClose}>
          <Bi id="common.close" inline />
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          <Bi id="detail.saveCorrection" inline />
        </button>
      </div>
    </form>
  );
}
