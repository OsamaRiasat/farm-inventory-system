import { handler, requireFarm } from "@/server/route";
import { receiveTransfer } from "@/server/services/slips";

/** The receiving farm and Prepared by come from the session. */
export const POST = handler("user", async ({ body, user }) => {
  const b = await body();
  return receiveTransfer({ ...b, farmId: requireFarm(user, b.farmId), preparedBy: user.name });
});
