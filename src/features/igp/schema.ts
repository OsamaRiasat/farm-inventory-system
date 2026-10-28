import { z } from "zod";
import { fmtQty } from "@/lib/format";
import { checkItemAndUnit, optionalText, positiveQty, slipBase, text, zeroOrMore, type RuleContext } from "@/lib/validation";

const igpLine = z.object({
  itemId: z.string(),
  qtyChallan: positiveQty,
  qtyReceived: z.number({ error: "err.enterQtyReceived" }).min(0, "err.enterQtyReceived"),
  weightKg: z.number().min(0).optional(),
});

/** F2 New IGP. Stock goes up by Qty Actual Received; less than the challan is a shortfall, not an error. */
export function igpSchema(rules: RuleContext) {
  return slipBase
    .extend({
      // Farms are not offered here: transfers come in through Receive transfer.
      source: z.object({
        kind: z.enum(["supplier", "other"], { error: "err.required" }),
        ms: text.min(1, "err.enterMs"),
      }),
      biltyNo: optionalText,
      truckNo: optionalText,
      driverName: optionalText,
      demandNo: optionalText,
      challanNo: optionalText,
      challanDate: optionalText,
      lines: z.array(igpLine).min(1, "err.noLines"),
    })
    .superRefine((v, ctx) => {
      v.lines.forEach((l, i) => checkItemAndUnit(rules, l.itemId, [l.qtyChallan, l.qtyReceived], ["lines", i], ctx));
    });
}

export type IgpInput = z.infer<ReturnType<typeof igpSchema>>;

/** F3 Receive transfer: only Qty Actual Received, never more than was sent. */
export function receiveSchema(rules: RuleContext, sent: { itemId: string; qty: number }[]) {
  return slipBase
    .extend({
      transferId: z.string().min(1),
      lines: z
        .array(z.object({ qtyReceived: zeroOrMore, weightKg: z.number().min(0).optional() }))
        .length(sent.length, "err.required"),
    })
    .superRefine((v, ctx) => {
      v.lines.forEach((l, i) => {
        const line = sent[i];
        if (!line) return;
        if (l.qtyReceived > line.qty) {
          ctx.addIssue({
            code: "custom",
            message: "err.cannotReceiveMore",
            params: { n: fmtQty(line.qty) },
            path: ["lines", i, "qtyReceived"],
          });
        }
        checkItemAndUnit(rules, line.itemId, [l.qtyReceived], ["lines", i], ctx);
      });
    });
}

export type ReceiveInput = z.infer<ReturnType<typeof receiveSchema>>;
