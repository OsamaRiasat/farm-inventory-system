import type { Slip } from "@/types/domain";

export type DetailMode = "farm" | "admin";

/** Where a slip's detail lives for each area. */
export function slipHref(mode: DetailMode, id: string) {
  return `/${mode === "farm" ? "farm" : "admin"}/slips/${encodeURIComponent(id)}`;
}

/** The quantity a correction changes on each line: Qty Actual Received for IGP, Qty for OGP / SIS. */
export function lineQty(slip: Slip, index: number) {
  const line = slip.lines[index];
  return line && "qtyReceived" in line ? line.qtyReceived : (line?.qty ?? 0);
}
