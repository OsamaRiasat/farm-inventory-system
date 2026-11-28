import type { Farm, Slip } from "@/types/domain";

/**
 * The number the farm knows the slip by: its paper slip number ("IGP-0123"), plus "-C1" on a correction.
 * Falls back to the system number for slips saved without one.
 */
export function slipNo(slip: Pick<Slip, "no" | "paperNo">) {
  if (!slip.paperNo) return slip.no;
  const suffix = /-C\d+$/.exec(slip.no)?.[0] ?? "";
  return slip.paperNo + suffix;
}

/** Every item on a slip, in order (SIS feed first, as on the paper), without repeats. */
export function slipItemIds(slip: Slip) {
  const ids = [...(slip.type === "SIS" ? slip.shedRows.map((r) => r.feedItemId) : []), ...slip.lines.map((l) => l.itemId)];
  return [...new Set(ids)];
}

/** Number of rows on the slip (SIS shed rows count too). */
export function slipLineCount(slip: Slip) {
  return slip.lines.length + (slip.type === "SIS" ? slip.shedRows.length : 0);
}

/** IGP: who it came from. OGP: where it went. SIS / Daily Report: nothing. */
export function slipParty(slip: Slip, farms: Farm[]) {
  const name = (id?: string) => farms.find((f) => f.id === id)?.name ?? "";
  if (slip.type === "IGP") return slip.source.kind === "farm" ? name(slip.source.farmId) : (slip.source.ms ?? "");
  if (slip.type === "OGP") return slip.to.kind === "farm" ? name(slip.to.farmId) : (slip.to.ms ?? "");
  return "";
}

/**
 * The free text written on a slip, for search: remarks, M/s, Bilty / truck / driver…, SIS Purpose of Use and
 * Ledger Folio, and the other farm's name on a transfer. Empty values left out.
 */
export function slipSearchFields(slip: Slip, farms: Farm[] = []) {
  const fields: (string | undefined)[] = [slipParty(slip, farms)];
  switch (slip.type) {
    case "IGP":
      fields.push(slip.remarks, slip.biltyNo, slip.truckNo, slip.driverName, slip.demandNo, slip.challanNo);
      break;
    case "OGP":
      fields.push(slip.remarks, slip.vehicleNo, slip.driverName);
      break;
    case "SIS":
      for (const l of slip.lines) fields.push(l.purpose, l.ledgerFolio);
      break;
    case "DR":
      fields.push(slip.remarks);
      break;
  }
  return [...new Set(fields.map((f) => f?.trim() ?? "").filter(Boolean))];
}
