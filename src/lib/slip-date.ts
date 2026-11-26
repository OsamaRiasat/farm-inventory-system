// Client #27: posting a batch of old slips, the date stays on the last one used instead of jumping back to today.
// Per farm, in this browser tab only (sessionStorage), cleared on sign out — a new day or a new login starts at today.

const key = (farmId: string) => `aw.slipDate.${farmId}`;

/** The slip date to start a new slip with: the last one saved in this tab, else today. Never after today. */
export function startDate(farmId: string, today: string): string {
  try {
    const last = sessionStorage.getItem(key(farmId));
    if (last && /^\d{4}-\d{2}-\d{2}$/.test(last) && last <= today) return last;
  } catch {
    // Storage blocked: today.
  }
  return today;
}

export function rememberSlipDate(farmId: string, date: string) {
  try {
    if (date) sessionStorage.setItem(key(farmId), date);
  } catch {
    // Not remembered; the next slip starts at today.
  }
}

export function forgetSlipDates() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("aw.slipDate.")) sessionStorage.removeItem(k);
  } catch {
    // Nothing to clear.
  }
}
