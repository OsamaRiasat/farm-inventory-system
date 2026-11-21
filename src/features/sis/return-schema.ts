import { z } from "zod";
import { fmtQty } from "@/lib/format";
import { checkItemAndUnit, positiveQty, remarks, required, type RuleContext } from "@/lib/validation";

/** What is left on each SIS line: issued minus what already came back. */
export type ReturnableLine = { itemId: string; issued: number; returned: number };

/**
 * "Return unused" on a saved SIS (F7 / A3). Only the lines with a quantity are sent.
 * Each line: above 0 and at most issued − already returned. Date: not before the issue date, never after today.
 */
export function returnSchema(rules: RuleContext, sis: { date: string; lines: ReturnableLine[] }) {
  return z
    .object({
      sisId: required,
      date: required,
      by: required,
      idempotencyKey: required,
      remarks,
      lines: z.array(z.object({ lineIndex: z.number().int().min(0), qty: positiveQty })).min(1, "err.noReturnQty"),
    })
    .superRefine((v, ctx) => {
      if (rules.today && v.date > rules.today) ctx.addIssue({ code: "custom", message: "err.dateFuture", path: ["date"] });
      if (v.date < sis.date) ctx.addIssue({ code: "custom", message: "err.returnBeforeIssue", path: ["date"] });
      const seen = new Set<number>();
      v.lines.forEach((l, i) => {
        const line = sis.lines[l.lineIndex];
        if (!line || seen.has(l.lineIndex)) {
          ctx.addIssue({ code: "custom", message: "err.notFound", path: ["lines", i, "lineIndex"] });
          return;
        }
        seen.add(l.lineIndex);
        checkItemAndUnit(rules, line.itemId, [l.qty], ["lines", i], ctx);
        const left = returnable(line);
        if (l.qty > left) {
          ctx.addIssue({ code: "custom", message: "err.onlyReturnable", params: { n: fmtQty(left) }, path: ["lines", i, "qty"] });
        }
      });
    });
}

/** Issued − already returned, without 0.1 + 0.2 drift. */
export function returnable(line: ReturnableLine) {
  return Math.round((line.issued - line.returned) * 1000) / 1000;
}

export type ReturnInput = z.input<ReturnType<typeof returnSchema>>;
