import type { Movement } from "@/types/domain";

// Balances are always derived from movements — never stored or typed in.

/** itemId → quantity on hand for one farm. */
export function farmBalances(movements: Movement[], farmId: string) {
  const balances = new Map<string, number>();
  for (const m of movements) {
    if (m.farmId !== farmId) continue;
    balances.set(m.itemId, round((balances.get(m.itemId) ?? 0) + m.qtyIn - m.qtyOut));
  }
  return balances;
}

/** farmId → itemId → quantity, for every farm at once (A4 matrix). */
export function allBalances(movements: Movement[]) {
  const byFarm = new Map<string, Map<string, number>>();
  for (const m of movements) {
    let farm = byFarm.get(m.farmId);
    if (!farm) byFarm.set(m.farmId, (farm = new Map()));
    farm.set(m.itemId, round((farm.get(m.itemId) ?? 0) + m.qtyIn - m.qtyOut));
  }
  return byFarm;
}

/** Movements of one item at one farm, oldest first, with the running balance after each. */
export function stockCard(movements: Movement[], farmId: string, itemId: string) {
  let balance = 0;
  return movements
    .filter((m) => m.farmId === farmId && m.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => {
      balance = round(balance + m.qtyIn - m.qtyOut);
      return { ...m, balance };
    });
}

/** Avoids 0.1 + 0.2 drift on KG / LTR quantities. */
function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
