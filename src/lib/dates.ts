// Slip dates are local ISO dates ("2026-10-27") and times ("10:40"); no time zones in phase 1.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function today() {
  return isoDate(new Date());
}

export function nowTime() {
  return isoTime(new Date());
}

/** Local date-time stamp "2026-10-27T10:40:00" (audit entries, requests). */
export function nowStamp(d = new Date()) {
  return `${isoDate(d)}T${isoTime(d)}:00`;
}

/** "2026-10-27T10:40:00" → "27 Oct 2026 10:40". */
export function fmtStamp(stamp: string) {
  return `${fmtDate(stamp.slice(0, 10))} ${stamp.slice(11, 16)}`;
}

/** "2026-10-27" → "27 Oct 2026". */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Whole days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}
