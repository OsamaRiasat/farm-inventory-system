// Stock is always summed from movements (src/lib/stock.ts rules), never stored.

import type { StockCardRow, StockMatrix, StockRow } from "@/lib/api/types";
import { round3 } from "@/lib/slip-rules";
import { slipNo } from "@/lib/slips";
import { stockCard } from "@/lib/stock";
import { db } from "../db";
import { toMovement } from "../mappers";
import { balancesOf } from "../repo";

export async function getStock(farmId: string): Promise<StockRow[]> {
  return [...(await balancesOf(db(), farmId))].map(([itemId, qty]) => ({ itemId, qty }));
}

export async function getStockMatrix(): Promise<StockMatrix> {
  const sums = await db().movement.groupBy({ by: ["farmId", "itemId"], _sum: { qtyIn: true, qtyOut: true } });
  const farms: StockMatrix["farms"] = {};
  for (const r of sums) (farms[r.farmId] ??= {})[r.itemId] = round3((r._sum.qtyIn ?? 0) - (r._sum.qtyOut ?? 0));
  const transit = await db().transfer.findMany({ where: { status: "in_transit" }, select: { ogpId: true } });
  const lines = await db().slipLine.findMany({ where: { slipId: { in: transit.map((t) => t.ogpId) } } });
  const inTransit: StockMatrix["inTransit"] = {};
  for (const l of lines) inTransit[l.itemId] = (inTransit[l.itemId] ?? 0) + (l.qty ?? 0);
  return { farms, inTransit };
}

export async function getStockCard(farmId: string, itemId: string): Promise<StockCardRow[]> {
  const movements = (await db().movement.findMany({ where: { farmId, itemId }, orderBy: { id: "asc" } })).map(toMovement);
  const ids = [...new Set(movements.map((m) => m.slipId))];
  const [returns, counts] = await Promise.all([
    db().sisReturn.findMany({ where: { id: { in: ids } }, select: { id: true, sisId: true } }),
    db().stockCount.findMany({ where: { id: { in: ids } }, select: { id: true, no: true } }),
  ]);
  const returnOf = new Map(returns.map((r) => [r.id, r.sisId]));
  const slips = new Map(
    (
      await db().slip.findMany({
        where: { id: { in: [...ids, ...returns.map((r) => r.sisId)] } },
        select: { id: true, no: true, paperNo: true, type: true },
      })
    ).map((s) => [s.id, s]),
  );
  const countNo = new Map(counts.map((c) => [c.id, c.no]));
  return stockCard(movements, farmId, itemId).map((m): StockCardRow => {
    const sisId = returnOf.get(m.slipId);
    if (sisId) {
      const sis = slips.get(sisId)!;
      return { ...m, ref: slipNo(sis), kind: "SIS", returnOf: sis.id };
    }
    const slip = slips.get(m.slipId);
    const count = slip ? undefined : countNo.get(m.slipId);
    return {
      ...m,
      ref: slip ? slipNo(slip) : (count ?? "Opening balance"),
      kind: slip?.type ?? (count ? "COUNT" : "OPENING"),
    };
  });
}
