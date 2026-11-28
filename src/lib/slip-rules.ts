import { fmtQty } from "@/lib/format";
import type { Farm, SISReturn, Slip } from "@/types/domain";

// Pure slip rules shared by the server services (src/server/services) — no data access here.

/** "AW-02" → "AW02", "AW Layer-01" → "AWLAYER01". */
export function slipPrefix(farm: Pick<Farm, "code">) {
  return farm.code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/** "AW02" + "IGP" + 1663 → "AW02-IGP-1663". */
export function formatNo(farm: Pick<Farm, "code">, kind: string, n: number) {
  return `${slipPrefix(farm)}-${kind}-${String(n).padStart(4, "0")}`;
}

/** Only gate passes can belong to a transfer. */
export function transferIdOf(slip: Slip) {
  return slip.type === "IGP" || slip.type === "OGP" ? slip.transferId : undefined;
}

/** Stock effect of a slip's lines (positive = into the farm). */
export function slipDeltas(slip: Slip): { itemId: string; delta: number }[] {
  switch (slip.type) {
    case "IGP":
      return slip.lines.map((l) => ({ itemId: l.itemId, delta: l.qtyReceived }));
    case "OGP":
      return slip.lines.map((l) => ({ itemId: l.itemId, delta: -l.qty }));
    case "SIS":
      return [
        ...slip.shedRows.map((r) => ({ itemId: r.feedItemId, delta: -r.feedKg })),
        ...slip.lines.map((l) => ({ itemId: l.itemId, delta: -l.qty })),
      ];
    case "DR":
      // Daily Report: its one line is the eggs left after hatching, market and discarded — into stock.
      return slip.lines.map((l) => ({ itemId: l.itemId, delta: l.qty }));
  }
}

/** "85, 6": the line quantities, for the audit log's before / after. */
export function lineSummary(slip: Slip) {
  const qtys = slip.lines.map((l) => ("qtyReceived" in l ? l.qtyReceived : l.qty));
  return qtys.map(fmtQty).join(", ");
}

/** Avoids 0.1 + 0.2 drift on KG / LTR quantities. */
export function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** Quantity already returned per SIS line (saved returns only). */
export function returnedPerLine(slip: Slip, returns: SISReturn[]): number[] {
  const totals = slip.lines.map(() => 0);
  for (const r of returns) {
    if (r.status !== "saved") continue;
    for (const l of r.lines) totals[l.lineIndex] = round3((totals[l.lineIndex] ?? 0) + l.qty);
  }
  return totals;
}

/** Paper numbers compare without spaces and case ("igp - 12" = "IGP-12"). Same as `samePaperNo`. */
export function paperNoKey(paperNo: string) {
  return paperNo.replace(/\s+/g, "").toUpperCase();
}
