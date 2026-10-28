import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { fmtDate } from "@/lib/dates";
import type { Farm, SlipStatus, SlipType } from "@/types/domain";

/**
 * C12 print frame: the paper slip's layout — company name, title box, farm code box, No. / Date / Time,
 * the slip's table, Prepared by and a blank signature line. A5 portrait by default, A4 option,
 * black and white. "Corrected" / "Cancelled" stamp across the page. The QR code goes in `qr`.
 */
export function PrintFrame({
  farm,
  type,
  no,
  date,
  time,
  preparedBy,
  status = "saved",
  size = "A5",
  qr,
  children,
}: {
  farm: Pick<Farm, "code" | "type">;
  type: SlipType;
  no: string;
  date: string;
  time: string;
  preparedBy: string;
  status?: SlipStatus;
  /** "screen" = full width, for showing the slip on F7 / A3. */
  size?: "A5" | "A4" | "screen";
  qr?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="print-frame relative mx-auto bg-white p-[8mm] text-black" data-size={size}>
      {status !== "saved" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="-rotate-[25deg] border-4 border-black/40 px-4 text-5xl font-bold tracking-widest text-black/40">
            <Bi id={status === "cancelled" ? "print.stampCancelled" : "print.stampCorrected"} inline />
          </span>
        </div>
      )}

      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <div className="text-xl font-bold tracking-wide">
            {farm.type === "layer" ? "SUTLEJ FEEDS LAYER" : "SUTLEJ FEEDS BREEDERS"}
          </div>
          <div className="mt-1 inline-block border-2 border-black px-3 py-0.5 font-bold">
            <Bi id={`slip.${type}`} inline />
          </div>
        </div>
        <div className="flex items-start gap-3">
          {qr}
          <div className="border-2 border-black px-3 py-1 text-center font-bold">{farm.code}</div>
        </div>
      </header>

      <dl className="num my-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="inline font-semibold">No. </dt>
          <dd className="inline">{no}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Date: </dt>
          <dd className="inline">{fmtDate(date)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Time: </dt>
          <dd className="inline">{time}</dd>
        </div>
      </dl>

      <div className="print-body text-sm">{children}</div>

      <footer className="mt-8 flex items-end justify-between gap-6 text-sm">
        <div className={clsx("min-w-40 border-t border-black pt-1")}>
          <div className="font-medium">{preparedBy}</div>
          <Bi id="slip.preparedBy" inline />
        </div>
        <div className="min-w-40 border-t border-black pt-1 text-right">
          <Bi id={type === "SIS" ? "print.approvedBy" : "print.projectManager"} inline />
        </div>
      </footer>
    </article>
  );
}
