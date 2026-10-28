import { z } from "zod";
import { allowsDecimals, fmtQty } from "@/lib/format";
import { t, type MsgId, type MsgValues } from "@/lib/i18n";
import en from "@/messages/en.json";
import type { Item } from "@/types/domain";

// Shared slip rules. Every message is a message id, so the form and the mock API say the same words.

/** What the rules need to know about the farm: its items and stock. */
export type RuleContext = {
  item: (id: string) => Item | undefined;
  stockOf: (itemId: string) => number;
};

export type FieldError = { path: (string | number)[]; id: MsgId; values?: MsgValues };

function isMsgId(s: string): s is MsgId {
  return s in en;
}

/** Zod issues → field errors. Zod's own type messages become "Required". */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.filter((p): p is string | number => typeof p !== "symbol"),
    id: isMsgId(issue.message) ? issue.message : "err.required",
    values: issue.code === "custom" ? (issue.params as MsgValues | undefined) : undefined,
  }));
}

export const text = z.string().trim();
export const optionalText = z.string().trim().optional();
export const required = z.string().trim().min(1, "err.required");

export const positiveQty = z.number({ error: "err.qtyAboveZero" }).positive("err.qtyAboveZero");
export const zeroOrMore = z.number({ error: "err.required" }).min(0, "err.required");

type Ctx = z.RefinementCtx;

export function checkItemAndUnit(rules: RuleContext, itemId: string, qtys: number[], path: (string | number)[], ctx: Ctx) {
  const item = rules.item(itemId);
  if (!item) {
    ctx.addIssue({ code: "custom", message: "err.pickItem", path: [...path, "itemId"] });
    return;
  }
  if (!allowsDecimals(item.unit) && qtys.some((q) => !Number.isInteger(q))) {
    ctx.addIssue({ code: "custom", message: "err.wholeNumber", params: { unit: t(`unit.${item.unit}`).en }, path });
  }
}

/** Adds up quantities per item across lines; the line that goes over the farm's stock gets the error. */
export function checkStock(
  rules: RuleContext,
  uses: { itemId: string; qty: number; path: (string | number)[] }[],
  ctx: Ctx,
) {
  const totals = new Map<string, number>();
  for (const use of uses) {
    const total = (totals.get(use.itemId) ?? 0) + use.qty;
    totals.set(use.itemId, total);
    const stock = rules.stockOf(use.itemId);
    if (total > stock) {
      ctx.addIssue({ code: "custom", message: "err.onlyInStock", params: { n: fmtQty(stock) }, path: use.path });
    }
  }
}

export const slipBase = z.object({
  farmId: required,
  date: required,
  time: required,
  preparedBy: required,
  idempotencyKey: required,
});
