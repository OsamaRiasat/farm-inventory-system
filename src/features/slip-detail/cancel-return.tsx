"use client";

import { Ban } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { api, ApiError } from "@/lib/api";
import { useApiMutation } from "@/lib/api/queries";
import type { MsgId, MsgValues } from "@/lib/i18n";
import type { SISReturn } from "@/types/domain";

/** A3: cancel a return entered by mistake, with a required reason. Stock goes back down. Focus starts on "Keep it". */
export function CancelReturnDialog({ record, onCancelled }: { record: SISReturn; onCancelled: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ id: MsgId; values?: MsgValues } | null>(null);
  const mutation = useApiMutation(api.cancelReturn);

  async function confirm() {
    if (!reason.trim()) return setError({ id: "err.enterReason" });
    try {
      await mutation.mutateAsync({ returnId: record.id, reason, by: "Accounts Admin" });
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
        className="btn min-h-9 text-sm text-danger"
        onClick={() => {
          setReason("");
          setError(null);
          dialogRef.current?.showModal();
          keepRef.current?.focus();
        }}
      >
        <Ban size={16} aria-hidden />
        <Bi id="ret.cancel" inline />
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
            <Bi id="ret.cancelTitle" values={{ no: record.no }} />
          </h2>
          <p className="text-sm">
            <Bi id="ret.cancelHint" />
          </p>
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
              <Bi id="ret.confirmCancel" inline />
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
