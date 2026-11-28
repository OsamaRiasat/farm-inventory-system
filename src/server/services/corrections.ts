// Admin corrections and cancellations, farm correction requests. Nothing is deleted: a correction is a new
// slip ("-C1") pointing to the original, and stock moves by the difference only.

import { ApiError } from "@/lib/api/errors";
import type { CorrectionInput, CorrectionRequestInput } from "@/lib/api/types";
import { nowStamp } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { lineSummary, returnedPerLine, round3, slipDeltas, transferIdOf } from "@/lib/slip-rules";
import type { CorrectionRequest, Slip } from "@/types/domain";
import { db } from "../db";
import { toCorrection } from "../mappers";
import {
  addMovements,
  assertNotNegative,
  audit,
  chain,
  getSlip,
  getTransfer,
  inTx,
  insertSlip,
  returnsOf,
  withFarmLock,
  type SaveOpts,
} from "../repo";

/** The slip's farm and, for a transfer's gate pass, the farm at the other end. */
async function farmsOfSlip(slipId: string) {
  const slip = await db().slip.findUnique({ where: { id: slipId }, select: { farmId: true, transferId: true } });
  if (!slip) throw new ApiError("err.notFound");
  if (!slip.transferId) return [slip.farmId];
  const t = await db().transfer.findUnique({ where: { id: slip.transferId }, select: { fromFarmId: true, toFarmId: true } });
  return [slip.farmId, t?.fromFarmId, t?.toFarmId];
}

/** Admin correction: a new slip with the right quantities; stock moves by the difference only. */
export async function correctSlip(input: CorrectionInput, opts: SaveOpts = {}): Promise<Slip> {
  return withFarmLock(await farmsOfSlip(input.slipId), async (tx) => {
    const original = await getSlip(tx, input.slipId);
    if (original.status !== "saved") throw new ApiError("err.alreadyClosed");
    // Daily Report: its one line is worked out from the counts, so a quantity can't be corrected — cancel and re-enter.
    if (original.type === "DR") throw new ApiError("err.drNoCorrection");
    if (!input.reason.trim()) throw new ApiError("err.enterReason");
    if (original.type === "OGP" && original.transferId) {
      const transfer = await getTransfer(tx, original.transferId);
      if (transfer && transfer.status !== "in_transit") throw new ApiError("err.cannotCancelReceived");
    }

    const corrected = structuredClone(original) as Slip;
    const feed = await tx.item.findMany({ where: { id: { in: corrected.lines.map((l) => l.itemId) }, isFeed: true }, select: { id: true } });
    const feedIds = new Set(feed.map((i) => i.id));
    for (const { index, qty, bags } of input.lines) {
      const line = corrected.lines[index];
      if (!line || qty < 0 || (corrected.type !== "IGP" && qty === 0)) throw new ApiError("err.qtyAboveZero");
      // Feed lines carry Bags next to the KG (client #26); a correction may fix them too.
      if (bags !== undefined && feedIds.has(line.itemId)) {
        if (!Number.isInteger(bags)) throw new ApiError("err.bagsWhole");
        if (bags < 1 && qty > 0) throw new ApiError("err.bagsRequired");
        line.bags = bags > 0 ? bags : undefined;
      }
      if ("qtyReceived" in line) {
        if (qty > line.qtyChallan && transferIdOf(corrected)) {
          throw new ApiError("err.cannotReceiveMore", { n: fmtQty(line.qtyChallan) });
        }
        line.qtyReceived = qty;
      } else {
        line.qty = qty;
      }
    }

    if (corrected.type === "SIS") {
      const returned = returnedPerLine(original, await returnsOf(tx, original));
      for (const { index } of input.lines) {
        const back = returned[index] ?? 0;
        if (back > 0 && corrected.lines[index].qty < back) throw new ApiError("err.belowReturned", { n: fmtQty(back) });
      }
    }

    const before = slipDeltas(original);
    const after = slipDeltas(corrected);
    const deltas = after.map((a, i) => ({ itemId: a.itemId, delta: a.delta - (before[i]?.delta ?? 0) }));
    await assertNotNegative(tx, original.farmId, deltas);

    const count = (await chain(tx, original)).length;
    corrected.id = `${original.no.replace(/-C\d+$/, "")}-C${count}`;
    corrected.no = corrected.id;
    corrected.postedAt = opts.at ?? nowStamp();
    corrected.correctionOf = original.id;
    corrected.correctedBy = undefined;
    corrected.status = "saved";
    await tx.slip.update({ where: { id: original.id }, data: { status: "corrected", correctedBy: corrected.id } });
    await insertSlip(tx, corrected);
    await addMovements(tx, corrected, deltas);

    const correctedTransferId = transferIdOf(corrected);
    if (correctedTransferId) {
      if (corrected.type === "OGP") await tx.transfer.update({ where: { id: correctedTransferId }, data: { ogpId: corrected.id } });
      if (corrected.type === "IGP") {
        await tx.transfer.update({
          where: { id: correctedTransferId },
          data: { igpId: corrected.id, status: corrected.lines.some((l) => l.qtyReceived < l.qtyChallan) ? "short" : "received" },
        });
      }
    }
    if (input.requestId) {
      await tx.correctionRequest.updateMany({
        where: { id: input.requestId },
        data: { status: "approved", correctionId: corrected.id },
      });
    }
    await audit(
      tx,
      {
        user: input.by,
        farmId: original.farmId,
        action: "correct",
        recordId: original.id,
        recordNo: original.no,
        old: lineSummary(original),
        new: lineSummary(corrected),
        reason: input.reason,
      },
      opts.at,
    );
    return corrected;
  });
}

/** Cancel reverses the slip's whole effect on stock. A received transfer's OGP can't be cancelled. */
export async function cancelSlip(input: { slipId: string; reason: string; by: string }, opts: SaveOpts = {}): Promise<Slip> {
  return withFarmLock(await farmsOfSlip(input.slipId), async (tx) => {
    const slip = await getSlip(tx, input.slipId);
    if (slip.status !== "saved") throw new ApiError("err.alreadyClosed");
    if (!input.reason.trim()) throw new ApiError("err.enterReason");

    const transferId = transferIdOf(slip);
    const transfer = transferId ? await getTransfer(tx, transferId) : undefined;
    if (slip.type === "OGP" && transfer && transfer.status !== "in_transit") throw new ApiError("err.cannotCancelReceived");

    // An SIS's returns are part of its effect: only what was really used (issued − returned) goes back.
    const returns = await returnsOf(tx, slip);
    const ids = [...(await chain(tx, slip)).map((s) => s.id), ...returns.map((r) => r.id)];
    const sums = await tx.movement.groupBy({
      by: ["itemId"],
      where: { farmId: slip.farmId, slipId: { in: ids } },
      _sum: { qtyIn: true, qtyOut: true },
    });
    const reversal = sums.map((r) => ({ itemId: r.itemId, delta: -round3((r._sum.qtyIn ?? 0) - (r._sum.qtyOut ?? 0)) }));
    await assertNotNegative(tx, slip.farmId, reversal);
    await addMovements(tx, slip, reversal);
    await tx.slip.update({ where: { id: slip.id }, data: { status: "cancelled" } });
    slip.status = "cancelled";
    const stamp = opts.at ?? nowStamp();
    await tx.sisReturn.updateMany({
      where: { id: { in: returns.filter((x) => x.status === "saved").map((r) => r.id) } },
      data: { status: "cancelled", cancelledBy: input.by, cancelledAt: stamp, cancelReason: input.reason.trim() },
    });

    if (transfer && slip.type === "OGP") await tx.transfer.update({ where: { id: transfer.id }, data: { status: "cancelled" } });
    if (transfer && slip.type === "IGP") {
      await tx.transfer.update({ where: { id: transfer.id }, data: { status: "in_transit", igpId: null, receivedAt: null } });
    }
    await audit(
      tx,
      { user: input.by, farmId: slip.farmId, action: "cancel", recordId: slip.id, recordNo: slip.no, reason: input.reason },
      opts.at,
    );
    return slip;
  });
}

export function requestCorrection(input: CorrectionRequestInput, opts: SaveOpts = {}): Promise<CorrectionRequest> {
  return inTx(async (tx) => {
    const slip = await getSlip(tx, input.slipId);
    if (slip.type === "DR") throw new ApiError("err.drNoCorrection");
    if (!slip.lines[input.lineIndex]) throw new ApiError("err.notFound");
    if (!input.reason.trim()) throw new ApiError("err.enterReason");
    if (!(input.requestedQty >= 0)) throw new ApiError("err.required");
    const row = await tx.correctionRequest.create({
      data: {
        id: `cr-${crypto.randomUUID()}`,
        slipId: slip.id,
        farmId: slip.farmId,
        lineIndex: input.lineIndex,
        requestedQty: input.requestedQty,
        reason: input.reason.trim(),
        requestedBy: input.requestedBy,
        at: opts.at ?? nowStamp(),
        status: "open",
      },
    });
    await audit(
      tx,
      { user: input.requestedBy, farmId: slip.farmId, action: "request_correction", recordId: slip.id, recordNo: slip.no, reason: row.reason },
      opts.at,
    );
    return toCorrection(row);
  });
}

export function rejectCorrection(input: { requestId: string; note: string; by: string }): Promise<CorrectionRequest> {
  return inTx(async (tx) => {
    const request = await tx.correctionRequest.findUnique({ where: { id: input.requestId } });
    if (!request || request.status !== "open") throw new ApiError("err.notFound");
    if (!input.note.trim()) throw new ApiError("err.enterReason");
    const row = await tx.correctionRequest.update({
      where: { id: request.id },
      data: { status: "rejected", note: input.note.trim() },
    });
    const slip = await getSlip(tx, request.slipId);
    await audit(tx, { user: input.by, farmId: slip.farmId, action: "reject_correction", recordId: slip.id, recordNo: slip.no, reason: row.note ?? "" });
    return toCorrection(row);
  });
}

export async function listCorrectionRequests(f: { farmId?: string; status?: "open" | "approved" | "rejected" } = {}) {
  const rows = await db().correctionRequest.findMany({
    where: { ...(f.farmId ? { farmId: f.farmId } : {}), ...(f.status ? { status: f.status } : {}) },
    orderBy: { at: "desc" },
  });
  return rows.map(toCorrection);
}
