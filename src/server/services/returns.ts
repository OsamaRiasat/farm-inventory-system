// "Return unused" after an SIS: the SIS stays as issued, stock goes up on the return date.

import { returnSchema, type ReturnableLine } from "@/features/sis/return-schema";
import { ApiError } from "@/lib/api/errors";
import { nowStamp } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { returnedPerLine } from "@/lib/slip-rules";
import type { SISReturn } from "@/types/domain";
import { db, type Tx } from "../db";
import { returnInclude, toReturn } from "../mappers";
import {
  addMovements,
  assertNotNegative,
  audit,
  getSlip,
  parse,
  remember,
  remembered,
  returnsOf,
  rulesFor,
  withFarmLock,
  type SaveOpts,
} from "../repo";

async function getReturn(tx: Tx, id: string) {
  const row = await tx.sisReturn.findUnique({ where: { id }, include: returnInclude });
  return row ? toReturn(row) : undefined;
}

/** Farm User or Admin: unused items come back from a saved SIS. Stock goes up on the return date. */
export async function returnUnused(input: unknown, opts: SaveOpts = {}): Promise<SISReturn> {
  const sisId = String((input as { sisId?: unknown })?.sisId ?? "");
  const farm = await db().slip.findUnique({ where: { id: sisId }, select: { farmId: true } });
  if (!farm) throw new ApiError("err.notFound");
  return withFarmLock([farm.farmId], async (tx) => {
    const done = await remembered(tx, (input as { idempotencyKey?: unknown })?.idempotencyKey);
    if (done) {
      const existing = await getReturn(tx, done);
      if (existing) return existing;
    }
    const sis = await getSlip(tx, sisId);
    if (sis.type !== "SIS") throw new ApiError("err.notFound");
    if (sis.status !== "saved") throw new ApiError("err.alreadyClosed");
    const returns = await returnsOf(tx, sis);
    const returned = returnedPerLine(sis, returns);
    const lines: ReturnableLine[] = sis.lines.map((l, i) => ({ itemId: l.itemId, issued: l.qty, returned: returned[i] ?? 0 }));
    const rules = await rulesFor(tx, sis.farmId, { itemIds: sis.lines.map((l) => l.itemId) }, opts.at);
    const v = parse(returnSchema(rules, { date: sis.date, lines }), input);

    const no = `${sis.no.replace(/-C\d+$/, "")}-R${returns.length + 1}`;
    const record: SISReturn = {
      id: no,
      no,
      sisId: sis.id,
      farmId: sis.farmId,
      date: v.date,
      postedAt: opts.at ?? nowStamp(),
      by: v.by,
      lines: v.lines.map((l) => ({ lineIndex: l.lineIndex, itemId: sis.lines[l.lineIndex].itemId, qty: l.qty })),
      remarks: v.remarks || undefined,
      status: "saved",
    };
    await tx.sisReturn.create({
      data: {
        id: record.id,
        no: record.no,
        sisId: record.sisId,
        farmId: record.farmId,
        date: record.date,
        postedAt: record.postedAt,
        by: record.by,
        remarks: record.remarks ?? null,
        status: "saved",
        lines: { create: record.lines.map((l, index) => ({ index, ...l })) },
      },
    });
    await addMovements(tx, record, record.lines.map((l) => ({ itemId: l.itemId, delta: l.qty })));
    await remember(tx, v.idempotencyKey, record.id);
    await audit(
      tx,
      {
        user: v.by,
        farmId: sis.farmId,
        action: "return",
        recordId: sis.id,
        recordNo: no,
        new: record.lines.map((l) => `+${fmtQty(l.qty)}`).join(", "),
        reason: record.remarks,
      },
      opts.at,
    );
    return record;
  });
}

/** Admin: a return entered by mistake. Stock goes back down, and never below zero. */
export async function cancelReturn(input: { returnId: string; reason: string; by: string }, opts: SaveOpts = {}): Promise<SISReturn> {
  const found = await db().sisReturn.findUnique({ where: { id: input.returnId }, select: { farmId: true } });
  if (!found) throw new ApiError("err.notFound");
  return withFarmLock([found.farmId], async (tx) => {
    const record = await getReturn(tx, input.returnId);
    if (!record) throw new ApiError("err.notFound");
    if (record.status !== "saved") throw new ApiError("err.returnClosed");
    if (!input.reason.trim()) throw new ApiError("err.enterReason");
    const reversal = record.lines.map((l) => ({ itemId: l.itemId, delta: -l.qty }));
    await assertNotNegative(tx, record.farmId, reversal);
    await addMovements(tx, record, reversal);
    const cancelled = { by: input.by, at: opts.at ?? nowStamp(), reason: input.reason.trim() };
    await tx.sisReturn.update({
      where: { id: record.id },
      data: { status: "cancelled", cancelledBy: cancelled.by, cancelledAt: cancelled.at, cancelReason: cancelled.reason },
    });
    await audit(
      tx,
      { user: input.by, farmId: record.farmId, action: "cancel_return", recordId: record.sisId, recordNo: record.no, reason: cancelled.reason },
      opts.at,
    );
    return { ...record, status: "cancelled", cancelled };
  });
}

/** Returns on this SIS (any version of it), oldest first, cancelled ones included. */
export async function listReturns(slipId: string) {
  return returnsOf(db(), await getSlip(db(), slipId));
}
