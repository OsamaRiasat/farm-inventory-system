"use client";

import { createContext, useContext } from "react";
import type { FieldError } from "@/lib/validation";

/**
 * Errors from the last save, with paths in the form's own terms:
 * ["lines", uiRow, "qty" | "item" | …], ["shed", uiRow, "feedKg" | "feedItem" | …], or a field name ("source.ms").
 */
export const SlipErrorsContext = createContext<FieldError[]>([]);

export function useSlipErrors() {
  return useContext(SlipErrorsContext);
}

/** Errors for one row of "lines" or "shed": the invalid field keys and the messages. */
export function rowErrors(errors: FieldError[], group: "lines" | "shed", row: number) {
  const mine = errors.filter((e) => e.path[0] === group && e.path[1] === row);
  return { keys: new Set(mine.map((e) => String(e.path[2] ?? ""))), errors: mine };
}

const KEY_NAMES: Record<string, string> = { itemId: "item", weightKg: "weight", feedItemId: "feedItem" };

/**
 * Maps API error paths (input indexes, API field names) back to the form (row on screen, form field names).
 * `lineRows[i]` / `shedRows[i]` = the screen row the i-th input line came from (empty rows are skipped).
 */
export function toFormErrors(errors: FieldError[], lineRows: number[], shedRows: number[] = []): FieldError[] {
  return errors.map((e) => {
    const [group, index, key, ...rest] = e.path;
    if ((group === "lines" || group === "shedRows") && typeof index === "number") {
      const rows = group === "lines" ? lineRows : shedRows;
      const k = typeof key === "string" ? (KEY_NAMES[key] ?? key) : key;
      return { ...e, path: [group === "lines" ? "lines" : "shed", rows[index] ?? index, ...(k === undefined ? [] : [k]), ...rest] };
    }
    return e;
  });
}
