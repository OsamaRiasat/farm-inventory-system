// Transfers between farms: an OGP to a farm waits until that farm receives it (receive is in slips.ts).

import { ApiError } from "@/lib/api/errors";
import type { TransferView } from "@/lib/api/types";
import { nowStamp } from "@/lib/dates";
import type { IGP, OGP, Transfer } from "@/types/domain";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { slipInclude, toSlip, toTransfer } from "../mappers";
import { audit, getSlip, inTx } from "../repo";

async function views(where: Prisma.TransferWhereInput): Promise<TransferView[]> {
  const rows = await db().transfer.findMany({ where, orderBy: { sentAt: "desc" } });
  const ids = rows.flatMap((t) => [t.ogpId, ...(t.igpId ? [t.igpId] : [])]);
  const slips = new Map((await db().slip.findMany({ where: { id: { in: ids } }, include: slipInclude })).map((s) => [s.id, toSlip(s)]));
  return rows.map((r) => {
    const transfer = toTransfer(r);
    return {
      transfer,
      ogp: slips.get(transfer.ogpId) as OGP,
      igp: transfer.igpId ? (slips.get(transfer.igpId) as IGP) : undefined,
    };
  });
}

export function listWaitingTransfers(farmId: string) {
  return views({ toFarmId: farmId, status: "in_transit" });
}

export function listTransfers(f: { farmId?: string } = {}) {
  return views(f.farmId ? { OR: [{ fromFarmId: f.farmId }, { toFarmId: f.farmId }] } : {});
}

export function resolveShortfall(input: { transferId: string; reason: string; by: string }): Promise<Transfer> {
  return inTx(async (tx) => {
    const row = await tx.transfer.findUnique({ where: { id: input.transferId } });
    if (!row || row.status !== "short" || row.resolutionKind) throw new ApiError("err.notFound");
    if (!input.reason.trim()) throw new ApiError("err.enterReason");
    const updated = await tx.transfer.update({
      where: { id: row.id },
      data: { resolutionKind: "written_off", resolutionBy: input.by, resolutionAt: nowStamp(), resolutionReason: input.reason.trim() },
    });
    const ogp = await getSlip(tx, row.ogpId);
    await audit(tx, { user: input.by, farmId: row.fromFarmId, action: "resolve_shortfall", recordId: row.id, recordNo: ogp.no, reason: input.reason });
    return toTransfer(updated);
  });
}
