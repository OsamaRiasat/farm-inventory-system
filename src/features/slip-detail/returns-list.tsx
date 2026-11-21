import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { fmtDate, fmtStamp } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Item, SISReturn } from "@/types/domain";

/** Quantity returned per SIS line, saved returns only (for Issued / Returned / Used). */
export function returnedByLine(returns: SISReturn[], lineCount: number) {
  const totals = Array.from({ length: lineCount }, () => 0);
  for (const r of returns) {
    if (r.status !== "saved") continue;
    for (const l of r.lines) totals[l.lineIndex] = Math.round(((totals[l.lineIndex] ?? 0) + l.qty) * 1000) / 1000;
  }
  return totals;
}

/**
 * "Returned unused" under an SIS's lines, on F7 / A3 and the print: date, item, +qty, who, remarks.
 * Cancelled returns stay visible, struck through, with the reason. `action` adds A3's Cancel per return.
 */
export function ReturnsList({ returns, items, action }: { returns: SISReturn[]; items: Map<string, Item>; action?: (r: SISReturn) => ReactNode }) {
  if (returns.length === 0) return null;
  return (
    <section className="mt-3" aria-label="Returned unused">
      <h3 className="mb-1 font-semibold">
        <Bi id="ret.section" inline />
      </h3>
      <ul className="flex flex-col gap-2">
        {returns.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-line pt-2" data-return={r.id}>
            <div className={clsx("flex flex-1 flex-col gap-0.5", r.status === "cancelled" && "text-muted line-through")}>
              {r.lines.map((l) => {
                const item = items.get(l.itemId);
                return (
                  <span key={l.lineIndex} className="num">
                    {fmtDate(r.date)} · {item?.name} · <span className="font-semibold text-igp">+{fmtQty(l.qty)}</span>{" "}
                    {item ? t(`unit.${item.unit}`).en : ""}
                  </span>
                );
              })}
              <span className="text-sm text-muted">
                <Bi id="ret.byUser" values={{ user: r.by }} inline />
                {r.remarks && (
                  <span dir="auto" className="ml-2">
                    — {r.remarks}
                  </span>
                )}
              </span>
            </div>
            {r.cancelled && (
              <p className="w-full text-sm text-danger">
                <Bi id="ret.cancelledNote" values={{ date: fmtStamp(r.cancelled.at), user: r.cancelled.by, reason: r.cancelled.reason }} inline />
              </p>
            )}
            {r.status === "saved" && action?.(r)}
          </li>
        ))}
      </ul>
    </section>
  );
}
