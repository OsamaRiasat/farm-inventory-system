// Slip dates are ISO dates ("2026-10-27") and times ("10:40") in Pakistan time — the farms' clock.
// today() / nowTime() / nowStamp() use Asia/Karachi explicitly, so a server running in UTC still
// stamps slips with the farm's date and time.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const FARM_TIME_ZONE = "Asia/Karachi";

const farmClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: FARM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Pakistan date ("2026-10-27") and time ("10:40") of a moment. */
export function farmNow(d = new Date()) {
  const p = Object.fromEntries(farmClock.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function today() {
  return farmNow().date;
}

export function nowTime() {
  return farmNow().time;
}

/** Pakistan date-time stamp "2026-10-27T10:40:00" (posted on, audit entries, requests). */
export function nowStamp(d = new Date()) {
  const { date, time } = farmNow(d);
  return `${date}T${time}:00`;
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
