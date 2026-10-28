// Items this farm picked recently, shown first in item search (C1). Per browser, best effort.

const MAX = 8;
const key = (farmId: string) => `awfarms.recentItems.${farmId}`;

export function recentItemIds(farmId: string): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(key(farmId)) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberItem(farmId: string, itemId: string) {
  try {
    const list = [itemId, ...recentItemIds(farmId).filter((id) => id !== itemId)].slice(0, MAX);
    localStorage.setItem(key(farmId), JSON.stringify(list));
  } catch {
    // Not remembered; search still works.
  }
}
