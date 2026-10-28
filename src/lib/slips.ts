import type { Farm, Slip } from "@/types/domain";

/** Every item on a slip, in order (SIS feed first, as on the paper), without repeats. */
export function slipItemIds(slip: Slip) {
  const ids = [...(slip.type === "SIS" ? slip.shedRows.map((r) => r.feedItemId) : []), ...slip.lines.map((l) => l.itemId)];
  return [...new Set(ids)];
}

/** Number of rows on the slip (SIS shed rows count too). */
export function slipLineCount(slip: Slip) {
  return slip.lines.length + (slip.type === "SIS" ? slip.shedRows.length : 0);
}

/** IGP: who it came from. OGP: where it went. SIS: nothing. */
export function slipParty(slip: Slip, farms: Farm[]) {
  const name = (id?: string) => farms.find((f) => f.id === id)?.name ?? "";
  if (slip.type === "IGP") return slip.source.kind === "farm" ? name(slip.source.farmId) : (slip.source.ms ?? "");
  if (slip.type === "OGP") return slip.to.kind === "farm" ? name(slip.to.farmId) : (slip.to.ms ?? "");
  return "";
}
