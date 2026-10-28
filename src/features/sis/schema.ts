import { z } from "zod";
import { checkItemAndUnit, checkStock, optionalText, positiveQty, slipBase, type RuleContext } from "@/lib/validation";

const count = z.number({ error: "err.required" }).int("err.wholeNumber").min(0, "err.required");

/**
 * F5 New SIS. Feed and items go down; mortality is recorded, not stock.
 * The form drops empty shed rows before saving.
 */
export function sisSchema(rules: RuleContext) {
  return slipBase
    .extend({
      shedRows: z.array(
        z.object({
          shedId: z.string().min(1),
          feedItemId: z.string(),
          feedKg: z.number({ error: "err.required" }).min(0, "err.required"),
          mortMale: count,
          mortFemale: count,
        }),
      ),
      lines: z.array(
        z.object({ itemId: z.string(), qty: positiveQty, purpose: optionalText, shedId: z.string().optional() }),
      ),
    })
    .superRefine((v, ctx) => {
      if (v.shedRows.length === 0 && v.lines.length === 0) {
        ctx.addIssue({ code: "custom", message: "err.noLines", path: ["lines"] });
      }
      v.shedRows.forEach((r, i) => {
        if (r.feedKg > 0 && !rules.item(r.feedItemId)?.isFeed) {
          ctx.addIssue({ code: "custom", message: "err.pickItem", path: ["shedRows", i, "feedItemId"] });
        }
      });
      v.lines.forEach((l, i) => checkItemAndUnit(rules, l.itemId, [l.qty], ["lines", i], ctx));
      checkStock(
        rules,
        [
          ...v.shedRows
            .map((r, i) => ({ itemId: r.feedItemId, qty: r.feedKg, path: ["shedRows", i, "feedKg"] }))
            .filter((use) => use.qty > 0),
          ...v.lines.map((l, i) => ({ itemId: l.itemId, qty: l.qty, path: ["lines", i, "qty"] })),
        ],
        ctx,
      );
    });
}

export type SisInput = z.infer<ReturnType<typeof sisSchema>>;
