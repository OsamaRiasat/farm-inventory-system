import { z } from "zod";
import { checkItemAndUnit, required, type RuleContext } from "@/lib/validation";

/** F10 Stock count: counted quantities replace the system's; a reason is required. */
export function stockCountSchema(rules: RuleContext) {
  return z
    .object({
      farmId: required,
      date: required,
      time: required,
      preparedBy: required,
      idempotencyKey: required,
      reason: z.string().trim().min(1, "err.enterReason"),
      lines: z
        .array(z.object({ itemId: z.string(), countedQty: z.number({ error: "err.required" }).min(0, "err.required") }))
        .min(1, "err.noLines"),
    })
    .superRefine((v, ctx) => {
      v.lines.forEach((l, i) => checkItemAndUnit(rules, l.itemId, [l.countedQty], ["lines", i], ctx));
    });
}

export type StockCountInput = z.infer<ReturnType<typeof stockCountSchema>>;
