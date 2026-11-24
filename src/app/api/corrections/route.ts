import { farmFor, handler } from "@/server/route";
import { listCorrectionRequests, requestCorrection } from "@/server/services/corrections";
import { visibleSlip } from "@/server/visible";

export const GET = handler("user", ({ query, user }) => {
  const status = query.get("status");
  return listCorrectionRequests({
    farmId: farmFor(user, query.get("farmId")),
    status: status === "open" || status === "approved" || status === "rejected" ? status : undefined,
  });
});

/** Farm User: ask the Admin to correct a line on one of their farm's slips. */
export const POST = handler("user", async ({ body, user }) => {
  const b = await body();
  const slip = await visibleSlip(user, String(b.slipId ?? ""), { ownOnly: true });
  return requestCorrection({
    slipId: slip.id,
    lineIndex: Number(b.lineIndex),
    requestedQty: Number(b.requestedQty),
    reason: String(b.reason ?? ""),
    requestedBy: user.name,
  });
});
