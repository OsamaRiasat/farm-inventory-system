import { z } from "zod";
import { checkItemAndUnit, checkStock, optionalText, positiveQty, slipBase, text, type RuleContext } from "@/lib/validation";

const destination = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("farm"), farmId: z.string().min(1, "err.pickFarm") }),
    z.object({
      kind: z.literal("outside"),
      ms: text.min(1, "err.enterMs"),
      reason: z.enum(["repair", "return", "other"], { error: "err.pickReason" }),
    }),
  ],
  { error: "err.required" },
);

/** F4 New OGP. Qty can never exceed the farm's stock. */
export function ogpSchema(rules: RuleContext) {
  return slipBase
    .extend({
      to: destination,
      driverName: optionalText,
      vehicleNo: optionalText,
      lines: z
        .array(z.object({ itemId: z.string(), qty: positiveQty, weightKg: z.number().min(0).optional() }))
        .min(1, "err.noLines"),
    })
    .superRefine((v, ctx) => {
      if (v.to.kind === "farm" && v.to.farmId === v.farmId) {
        ctx.addIssue({ code: "custom", message: "err.sameFarm", path: ["to", "farmId"] });
      }
      v.lines.forEach((l, i) => checkItemAndUnit(rules, l.itemId, [l.qty], ["lines", i], ctx));
      checkStock(
        rules,
        v.lines.map((l, i) => ({ itemId: l.itemId, qty: l.qty, path: ["lines", i, "qty"] })),
        ctx,
      );
    });
}

export type OgpInput = z.infer<ReturnType<typeof ogpSchema>>;
