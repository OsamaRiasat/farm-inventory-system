import { z } from "zod";
import { fmtDate } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { checkSlipBase, remarks, slipBase, type RuleContext } from "@/lib/validation";

/** The egg and tray counts on a Daily Report, in the order of the form. */
export const DR_COUNTS = [
  "eggsReceived",
  "hatchingEggs",
  "marketEggs",
  "discardedEggs",
  "gattaTray",
  "plasticTray",
  "eggsBox",
] as const;
export type DrCount = (typeof DR_COUNTS)[number];

/** A count: a whole number, 0 or more. Blank → "Required". */
const count = z.number({ error: "err.required" }).int("err.drWhole").min(0, "err.zeroOrMore");
/** Hatching / Market / Discarded and the trays: left blank = 0 (only Total Eggs Received must be typed). */
const countOr0 = count.default(0);

/**
 * Eggs that go into stock: Total Eggs Received − Hatching − Market − Discarded. The only stock effect of a
 * Daily Report (trays and boxes are recorded, never stock). Never below 0 once the rules pass.
 */
export function eggsToStock(v: { eggsReceived: number; hatchingEggs: number; marketEggs: number; discardedEggs: number }) {
  return v.eggsReceived - v.hatchingEggs - v.marketEggs - v.discardedEggs;
}

/** What the Daily Report rules need beyond the slip rules: the farm's report already saved for a date, if any. */
export type DrRules = RuleContext & {
  /** Paper No. ("DR-0003") of this farm's Daily Report on that date that isn't cancelled. */
  reportOn?: (date: string) => string | undefined;
};

/**
 * T07 Daily Report. Same schema in the browser (before saving) and on the server (`saveDR`), same messages.
 * - every count a whole number ≥ 0; only Total Eggs Received is required, the others default to 0
 * - Hatching + Market + Discarded ≤ Total Eggs Received
 * - one report per farm per date (open question for the client — 07-roadmap-and-open-questions.md)
 */
export function drSchema(rules: DrRules) {
  return slipBase
    .extend({
      eggsReceived: count,
      hatchingEggs: countOr0,
      marketEggs: countOr0,
      discardedEggs: countOr0,
      gattaTray: countOr0,
      plasticTray: countOr0,
      eggsBox: countOr0,
      remarks,
    })
    .superRefine((v, ctx) => {
      checkSlipBase(rules, "DR", v, ctx);
      const used = v.hatchingEggs + v.marketEggs + v.discardedEggs;
      if (used > v.eggsReceived) {
        ctx.addIssue({
          code: "custom",
          message: "err.drEggsOver",
          params: { n: fmtQty(used), total: fmtQty(v.eggsReceived) },
          path: ["eggsReceived"],
        });
      }
      const existing = v.date ? rules.reportOn?.(v.date) : undefined;
      if (existing) {
        ctx.addIssue({ code: "custom", message: "err.drDateUsed", params: { date: fmtDate(v.date), no: existing }, path: ["date"] });
      }
    });
}

export type DrInput = z.infer<ReturnType<typeof drSchema>>;
