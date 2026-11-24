import type { Slip } from "@/types/domain";
import type { SessionUser } from "./auth";
import { Forbidden } from "./route";
import { getSlipById } from "./services/slips";

/**
 * A slip the user may see. Farm User: their own farm's slips, and the other farm's gate pass of a transfer
 * with their farm (the OGP they are receiving, the IGP that received theirs). `ownOnly`: own farm's slips only.
 */
export async function visibleSlip(user: SessionUser, slipId: string, opts: { ownOnly?: boolean } = {}): Promise<Slip> {
  const slip = await getSlipById(slipId);
  if (user.role === "admin" || slip.farmId === user.farmId) return slip;
  if (opts.ownOnly) throw new Forbidden();
  const other = slip.type === "OGP" ? slip.to.farmId : slip.type === "IGP" ? slip.source.farmId : undefined;
  if (other && other === user.farmId) return slip;
  throw new Forbidden();
}
