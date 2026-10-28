"use client";

import Link from "next/link";
import { Ban, CircleCheck, Info, PencilLine, Printer, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { StatusChip } from "@/components/layout/status-chip";
import { TypeChip } from "@/components/layout/type-chip";
import { PrintFrame } from "@/components/slip/print-frame";
import { SlipBody } from "@/components/slip/slip-body";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useAudit, useCorrectionRequests, useFarms, useItemMap, useSlip } from "@/lib/api/queries";
import { fmtStamp } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import type { MsgId, MsgValues } from "@/lib/i18n";
import { CancelDialog } from "./cancel-dialog";
import { CorrectPanel } from "./correct-panel";
import { RequestCorrectionDialog } from "./request-correction";
import { slipHref, type DetailMode } from "./util";

export { slipHref, type DetailMode } from "./util";

/**
 * F7 / A3 — the slip laid out like the paper, read-only, with its history.
 * Farm: Print, Request correction. Admin: Print, Correct, Cancel.
 */
export function SlipDetail({
  slipId,
  mode,
  onlyFarmId,
  justSaved,
  requestId,
}: {
  slipId: string;
  mode: DetailMode;
  /** Farm User: slips of other farms are "not found". */
  onlyFarmId?: string;
  justSaved?: boolean;
  /** Admin opened this from a correction request (A6 → Approve). */
  requestId?: string;
}) {
  const slip = useSlip(slipId);
  const farms = useFarms().data ?? [];
  const items = useItemMap();
  const farmId = slip.data?.farmId;
  const audit = useAudit({ farmId });
  const requests = useCorrectionRequests({ farmId });
  const [correcting, setCorrecting] = useState(!!requestId);
  const [notice, setNotice] = useState<{ id: MsgId; values?: MsgValues } | null>(null);

  if (slip.isError) return <LoadError onRetry={() => slip.refetch()} />;
  if (!slip.data) return <SkeletonRows rows={6} />;

  const s = slip.data;
  if (onlyFarmId && s.farmId !== onlyFarmId) {
    return (
      <p className="card p-4 text-muted">
        <Bi id="err.notFound" />
      </p>
    );
  }

  const farm = farms.find((f) => f.id === s.farmId);
  const history = (audit.data ?? []).filter((a) => a.recordId === s.id);
  const correctedBy = history.find((a) => a.action === "correct");
  const cancelledBy = history.find((a) => a.action === "cancel");
  const mine = (requests.data ?? []).filter((r) => r.slipId === s.id);
  const request = requestId ? mine.find((r) => r.id === requestId && r.status === "open") : undefined;
  const editable = s.status === "saved";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TypeChip type={s.type} />
        <h1 className="num text-xl font-semibold">{s.no}</h1>
        <StatusChip status={s.status} />
        <span className="flex-1" />
        <Link href={`/print/${encodeURIComponent(s.id)}`} className="btn">
          <Printer size={18} aria-hidden />
          <Bi id="slip.print" inline />
        </Link>
        {mode === "farm" && editable && <RequestCorrectionDialog slip={s} items={items} onSent={() => setNotice({ id: "detail.requestSent" })} />}
        {mode === "admin" && editable && !correcting && (
          <button type="button" className="btn" onClick={() => setCorrecting(true)}>
            <PencilLine size={18} aria-hidden />
            <Bi id="detail.correct" inline />
          </button>
        )}
        {mode === "admin" && editable && <CancelDialog slip={s} onCancelled={() => setNotice({ id: "detail.cancelledDone" })} />}
      </div>

      {justSaved && (
        <Banner tone="ok">
          <Bi id="slip.saved" values={{ type: s.type, no: s.no }} />
        </Banner>
      )}
      {notice && (
        <Banner tone="ok">
          <Bi id={notice.id} values={notice.values} />
        </Banner>
      )}
      {s.status === "corrected" && (
        <Banner tone="info">
          <Bi
            id="detail.correctedBanner"
            values={{ date: correctedBy ? fmtStamp(correctedBy.at) : "", user: correctedBy?.user ?? "", reason: correctedBy?.reason ?? "" }}
          />
          {s.correctedBy && (
            <Link href={slipHref(mode, s.correctedBy)} className="font-semibold underline">
              <Bi id="detail.viewCorrection" values={{ no: s.correctedBy }} inline />
            </Link>
          )}
        </Banner>
      )}
      {s.status === "cancelled" && (
        <Banner tone="danger">
          <Bi
            id="detail.cancelledBanner"
            values={{ date: cancelledBy ? fmtStamp(cancelledBy.at) : "", user: cancelledBy?.user ?? "", reason: cancelledBy?.reason ?? "" }}
          />
        </Banner>
      )}
      {s.correctionOf && (
        <Banner tone="info">
          <Bi id="detail.correctionOf" values={{ no: s.correctionOf }} />
          <Link href={slipHref(mode, s.correctionOf)} className="font-semibold underline">
            <Bi id="detail.openOriginal" values={{ no: s.correctionOf }} inline />
          </Link>
        </Banner>
      )}
      {mine.map((r) => (
        <Banner key={r.id} tone={r.status === "rejected" ? "danger" : r.status === "approved" ? "ok" : "warn"}>
          {r.status === "open" && (
            <Bi id="detail.requestOpen" values={{ line: r.lineIndex + 1, qty: fmtQty(r.requestedQty), reason: r.reason }} />
          )}
          {r.status === "rejected" && <Bi id="detail.requestRejected" values={{ note: r.note ?? "" }} />}
          {r.status === "approved" && <Bi id="detail.requestApproved" />}
        </Banner>
      ))}

      {mode === "admin" && correcting && editable && (!requestId || requests.data) && (
        <CorrectPanel
          // Opened from A6: start again once the request has loaded, so it is pre-filled.
          key={request?.id ?? "none"}
          slip={s}
          items={items}
          request={request}
          onClose={() => setCorrecting(false)}
          onSaved={(no) => {
            setCorrecting(false);
            setNotice({ id: "detail.correctionSaved", values: { no } });
          }}
        />
      )}

      {farm && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <PrintFrame farm={farm} type={s.type} no={s.no} date={s.date} time={s.time} preparedBy={s.preparedBy} status={s.status} size="screen">
            <SlipBody slip={s} items={items} farms={farms} />
          </PrintFrame>
        </div>
      )}
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "info" | "warn" | "danger"; children: ReactNode }) {
  const styles = {
    ok: ["border-primary bg-success-bg", CircleCheck, "text-primary"],
    info: ["border-sis bg-surface", Info, "text-sis"],
    warn: ["border-warning bg-warning-bg", TriangleAlert, "text-warning"],
    danger: ["border-danger bg-danger-bg", Ban, "text-danger"],
  } as const;
  const [box, Icon, iconColor] = styles[tone];
  return (
    <div role="status" className={`flex items-start gap-2 rounded-lg border p-3 ${box}`}>
      <Icon size={20} className={`mt-1 shrink-0 ${iconColor}`} aria-hidden />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
