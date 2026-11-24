// F10 Stock count: counted quantities replace the system's; the difference is a movement.

import { stockCountSchema } from "@/features/stock-count/schema";
import type { StockCount } from "@/types/domain";
import { countInclude, toStockCount } from "../mappers";
import { addMovements, audit, getFarm, itemIdsOf, nextNo, parse, remember, remembered, rulesFor, withFarmLock, type SaveOpts } from "../repo";

export function saveStockCount(input: unknown, opts: SaveOpts = {}): Promise<StockCount> {
  const farmId = String((input as { farmId?: unknown })?.farmId ?? "");
  return withFarmLock([farmId], async (tx) => {
    const done = await remembered(tx, (input as { idempotencyKey?: unknown })?.idempotencyKey);
    if (done) {
      const row = await tx.stockCount.findUnique({ where: { id: done }, include: countInclude });
      if (row) return toStockCount(row);
    }
    const rules = await rulesFor(tx, farmId, { itemIds: itemIdsOf(input) }, opts.at);
    const v = parse(stockCountSchema(rules), input);
    const farm = await getFarm(tx, v.farmId);
    const no = await nextNo(tx, farm, "CNT", opts.no);
    const count: StockCount = {
      id: no,
      no,
      farmId: farm.id,
      date: v.date,
      time: v.time,
      preparedBy: v.preparedBy,
      reason: v.reason,
      lines: v.lines.map((l) => ({ itemId: l.itemId, systemQty: rules.stockOf(l.itemId), countedQty: l.countedQty })),
    };
    await tx.stockCount.create({
      data: {
        id: count.id,
        no: count.no,
        farmId: count.farmId,
        date: count.date,
        time: count.time,
        preparedBy: count.preparedBy,
        reason: count.reason,
        lines: { create: count.lines.map((l, index) => ({ index, ...l })) },
      },
    });
    await addMovements(tx, count, count.lines.map((l) => ({ itemId: l.itemId, delta: l.countedQty - l.systemQty })));
    await remember(tx, v.idempotencyKey, count.id);
    await audit(tx, { user: v.preparedBy, farmId: farm.id, action: "count", recordId: count.id, recordNo: count.no, reason: v.reason }, opts.at);
    return count;
  });
}
