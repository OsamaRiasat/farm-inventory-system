import { parseQty } from "@/lib/format";

/**
 * Reads a slip form: plain fields, plus rows named "lines.N.key" and "shed.N.key".
 * Rows keep their screen index so save errors can be shown on the right row.
 */
export function readSlipForm(data: FormData) {
  const fields: Record<string, string> = {};
  const groups: Record<"lines" | "shed", Map<number, Record<string, string>>> = { lines: new Map(), shed: new Map() };
  for (const [key, value] of data.entries()) {
    if (typeof value !== "string") continue;
    const m = /^(lines|shed)\.(\d+)\.(\w+)$/.exec(key);
    if (m) {
      const group = groups[m[1] as "lines" | "shed"];
      const row = Number(m[2]);
      group.set(row, { ...group.get(row), [m[3]]: value });
    } else {
      fields[key] = value;
    }
  }
  const sorted = (g: Map<number, Record<string, string>>) => [...g].sort(([a], [b]) => a - b);
  return { fields, lines: sorted(groups.lines), shed: sorted(groups.shed) };
}

/** A typed number, or undefined when blank (so the rule says "Required" / "Enter a quantity"). */
export function num(text: string | undefined) {
  return parseQty(text ?? "") ?? undefined;
}

/** Trimmed text, or undefined when blank. */
export function opt(text: string | undefined) {
  const t = (text ?? "").trim();
  return t || undefined;
}

/** True when a row has nothing typed in any of the given fields. */
export function isBlank(row: Record<string, string>, keys: string[]) {
  return keys.every((k) => !(row[k] ?? "").trim());
}

/** A key that stays the same for one slip, so a second tap or a retry can't save it twice. */
export function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
