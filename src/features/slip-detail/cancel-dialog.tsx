"use client";

import { Ban } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { api, ApiError } from "@/lib/api";
import { useApiMutation } from "@/lib/api/queries";
import type { MsgId, MsgValues } from "@/lib/i18n";
import type { Slip } from "@/types/domain";

/** A3 Cancel: reverses the slip's effect on stock, with a required reason. Focus starts on "Keep it". */
export function CancelDialog({ slip, onCancelled }: { slip: Slip; onCancelled: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ id: MsgId; values?: MsgValues } | null>(null);
  const mutation = useApiMutation(api.cancelSlip);
  const isTransfer = slip.type === "OGP" && !!slip.transferId;

  async function confirm() {
    if (!reason.trim()) return setError({ id: "err.enterReason" });
    try {
      await mutation.mutateAsync({ slipId: slip.id, reason, by: "Accounts Admin" });
      dialogRef.current?.close();
      onCancelled();
    } catch (e) {
      setError(e instanceof ApiError ? { id: e.id, values: e.values } : { id: "err.notSaved" });
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn text-danger"
        onClick={() => {
          dialogRef.current?.showModal();
          keepRef.current?.focus();
        }}
      >
        <Ban size={18} aria-hidden />
        <Bi id="detail.cancel" inline />
      </button>
      <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <h2 id={titleId} className="text-lg font-semibold">
            <Bi id="detail.cancelTitle" values={{ no: slip.no }} />
          </h2>
          <p className="text-sm">
            <Bi id="detail.cancelHint" />
          </p>
          {isTransfer && (
            <p className="rounded-lg bg-warning-bg p-2 text-sm text-warning">
              <Bi id="detail.cancelTransferHint" />
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="detail.reason" />
            <input
              dir="auto"
              className="input"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              <Bi id={error.id} values={error.values} inline />
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button ref={keepRef} type="button" className="btn btn-primary" onClick={() => dialogRef.current?.close()}>
              <Bi id="detail.keep" inline />
            </button>
            <button type="submit" className="btn border-danger text-danger" disabled={mutation.isPending}>
              <Bi id="detail.confirmCancel" inline />
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
