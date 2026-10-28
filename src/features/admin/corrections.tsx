"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { lineQty } from "@/features/slip-detail/util";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useCorrectionRequests, useFarms, useItemMap, useSlips } from "@/lib/api/queries";
import { fmtStamp } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { tInline, type MsgId } from "@/lib/i18n";
import type { CorrectionRequest } from "@/types/domain";

type Status = CorrectionRequest["status"];

/** A6 — requests from farms. Approve opens A3's Correct, pre-filled; Reject asks for a note the farm sees on F7. */
export function Corrections() {
  const farmId = useAdminFarm();
  const [status, setStatus] = useState<Status | "">("open");
  const requests = useCorrectionRequests({ farmId: farmId || undefined, status: status || undefined });
  const slips = useSlips({ farmId: farmId || undefined });
  const farms = useFarms().data ?? [];
  const items = useItemMap();

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.corrections" />
      </h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label={tInline("filter.status")}>
        {(["open", "approved", "rejected", ""] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            aria-pressed={status === s}
            className={status === s ? "btn btn-primary min-h-10" : "btn min-h-10"}
            onClick={() => setStatus(s)}
          >
            <Bi id={s ? (`corr.${s}` as MsgId) : "slips.all"} inline />
          </button>
        ))}
      </div>
      {requests.isError ? (
        <LoadError onRetry={() => requests.refetch()} />
      ) : !requests.data ? (
        <SkeletonRows rows={4} />
      ) : requests.data.length === 0 ? (
        <p className="card p-4 text-muted">
          <Bi id="corr.empty" />
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <Bi id="rep.when" />
                </th>
                <th>
                  <Bi id="col.farm" />
                </th>
                <th>
                  <Bi id="col.no" />
                </th>
                <th>
                  <Bi id="detail.line" />
                </th>
                <th className="text-right">
                  <Bi id="detail.currentQty" />
                </th>
                <th className="text-right">
                  <Bi id="corr.requested" />
                </th>
                <th>
                  <Bi id="detail.reason" />
                </th>
                <th>
                  <Bi id="col.status" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.data.map((r) => {
                const slip = slips.data?.find((s) => s.id === r.slipId);
                const line = slip?.lines[r.lineIndex];
                return (
                  <tr key={r.id}>
                    <td className="num whitespace-nowrap">{fmtStamp(r.at)}</td>
                    <td className="whitespace-nowrap">{farms.find((f) => f.id === r.farmId)?.code}</td>
                    <td>
                      <Link className="num whitespace-nowrap text-primary underline" href={`/admin/slips/${encodeURIComponent(r.slipId)}`}>
                        {r.slipId}
                      </Link>
                    </td>
                    <td>
                      {r.lineIndex + 1}. {line ? items.get(line.itemId)?.name : ""}
                    </td>
                    <td className="num text-right">{slip ? fmtQty(lineQty(slip, r.lineIndex)) : ""}</td>
                    <td className="num text-right font-semibold">{fmtQty(r.requestedQty)}</td>
                    <td dir="auto">
                      {r.reason}
                      <div className="text-xs text-muted">{r.requestedBy}</div>
                    </td>
                    <td>
                      <Bi id={`corr.${r.status}`} inline />
                      {r.note && <div className="text-xs text-muted">{r.note}</div>}
                    </td>
                    <td>
                      {r.status === "open" && (
                        <span className="flex gap-2">
                          <Link className="btn btn-primary min-h-10" href={`/admin/slips/${encodeURIComponent(r.slipId)}?request=${r.id}`}>
                            <Bi id="corr.approve" inline />
                          </Link>
                          <RejectButton request={r} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RejectButton({ request }: { request: CorrectionRequest }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState<MsgId | null>(null);
  const reject = useApiMutation(api.rejectCorrection);

  return (
    <>
      <button type="button" className="btn min-h-10" onClick={() => dialogRef.current?.showModal()}>
        <Bi id="corr.reject" inline />
      </button>
      <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return setError("err.enterReason");
            try {
              await reject.mutateAsync({ requestId: request.id, note, by: "Accounts Admin" });
              dialogRef.current?.close();
            } catch (err) {
              setError(err instanceof ApiError ? err.id : "err.notSaved");
            }
          }}
        >
          <h2 id={titleId} className="text-lg font-semibold">
            <Bi id="corr.rejectTitle" />
          </h2>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="corr.note" />
            <input dir="auto" className="input" autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
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
            <button type="submit" className="btn btn-primary" disabled={reject.isPending}>
              <Bi id="corr.reject" inline />
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
