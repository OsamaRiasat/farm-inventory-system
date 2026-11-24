// Direct database helpers for the rules / backend tests (Node side, the test database).
import { db } from "@/server/db";
import { balancesOf } from "@/server/repo";

let n = 0;

/**
 * A fresh, inactive farm with its own opening stock, so each rules test is independent of the seeded farms
 * and of the screen tests running at the same time. Inactive farms don't show on the dashboard.
 */
export async function testFarm(opening: Record<string, number> = {}) {
  const id = `t${Date.now().toString(36)}${process.pid.toString(36)}${n++}`;
  await db().farm.create({ data: { id, code: id.toUpperCase(), name: `Test ${id}`, type: "breeder", active: false } });
  const rows = Object.entries(opening).map(([itemId, qty]) => ({ farmId: id, itemId, slipId: "opening", date: "2026-01-01", qtyIn: qty, qtyOut: 0 }));
  if (rows.length) await db().movement.createMany({ data: rows });
  return id;
}

export async function stock(farmId: string, itemId: string) {
  return (await balancesOf(db(), farmId, [itemId])).get(itemId) ?? 0;
}

/** Unique per call and per run, for idempotency keys and paper numbers. */
export function unique(prefix = "k") {
  return `${prefix}-${Date.now().toString(36)}-${process.pid}-${n++}`;
}
