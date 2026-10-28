"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, CircleCheck, Printer, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Bi } from "@/components/layout/bi";
import { PrintFrame } from "@/components/slip/print-frame";
import { QrCode } from "@/components/slip/qr-code";
import { SlipBody } from "@/components/slip/slip-body";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useFarms, useItemMap, useSlip } from "@/lib/api/queries";
import { useSession } from "@/lib/session";
import type { Slip } from "@/types/domain";

const SIZE_KEY = "awfarms.printSize";
const noSubscribe = () => () => {};

function storedSize(): "A5" | "A4" {
  try {
    return localStorage.getItem(SIZE_KEY) === "A4" ? "A4" : "A5";
  } catch {
    return "A5";
  }
}

/** Where scanning the QR code leads: the waiting receipt for a transfer, otherwise the slip. */
export function qrTarget(slip: Slip, origin: string) {
  if (slip.type === "OGP" && slip.transferId && slip.to.kind === "farm") {
    return `${origin}/farm/igp/receive/${encodeURIComponent(slip.transferId)}`;
  }
  return `${origin}/farm/slips/${encodeURIComponent(slip.id)}`;
}

/** S2 — the slip in its paper layout, A5 (default) or A4, with print and share. */
export function PrintView({ slipId, justSaved }: { slipId: string; justSaved: boolean }) {
  const router = useRouter();
  const session = useSession();
  const slip = useSlip(slipId);
  const farms = useFarms().data ?? [];
  const items = useItemMap();
  const initialSize = useSyncExternalStore(noSubscribe, storedSize, () => "A5" as const);
  const [chosen, setChosen] = useState<"A5" | "A4" | null>(null);
  const [copied, setCopied] = useState(false);
  const size = chosen ?? initialSize;
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");

  function setSize(next: "A5" | "A4") {
    setChosen(next);
    try {
      localStorage.setItem(SIZE_KEY, next);
    } catch {
      // Not remembered.
    }
  }

  function back() {
    if (window.history.length > 1) router.back();
    else router.push(session?.role === "admin" ? "/admin" : "/farm");
  }

  async function share() {
    if (!slip.data) return;
    const url = `${origin}/print/${encodeURIComponent(slip.data.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: slip.data.no, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Share sheet closed.
    }
  }

  const farm = farms.find((f) => f.id === slip.data?.farmId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" className="btn" onClick={back}>
          <ChevronLeft size={20} aria-hidden />
          <Bi id="nav.back" inline />
        </button>
        <div className="flex-1" />
        <div role="radiogroup" aria-label="A5 / A4" className="flex gap-1">
          {(["A5", "A4"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={size === s} className={size === s ? "btn btn-primary" : "btn"} onClick={() => setSize(s)}>
              {s}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={share} disabled={!slip.data}>
          <Share2 size={18} aria-hidden />
          <Bi id={copied ? "print.linkCopied" : "print.share"} inline />
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!slip.data} autoFocus>
          <Printer size={18} aria-hidden />
          <Bi id="slip.print" inline />
        </button>
      </div>

      {justSaved && slip.data && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-primary bg-success-bg p-3 font-medium print:hidden">
          <CircleCheck className="shrink-0 text-primary" aria-hidden />
          <Bi id="print.savedHint" values={{ no: slip.data.no }} />
        </p>
      )}

      {slip.isError ? (
        <LoadError onRetry={() => slip.refetch()} />
      ) : !slip.data || !farm ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="mx-auto w-fit shadow-lg print:shadow-none">
            <PrintFrame
              farm={farm}
              type={slip.data.type}
              no={slip.data.no}
              date={slip.data.date}
              time={slip.data.time}
              preparedBy={slip.data.preparedBy}
              status={slip.data.status}
              size={size}
              qr={origin ? <QrCode value={qrTarget(slip.data, origin)} /> : null}
            >
              <SlipBody slip={slip.data} items={items} farms={farms} />
            </PrintFrame>
          </div>
        </div>
      )}
    </div>
  );
}
