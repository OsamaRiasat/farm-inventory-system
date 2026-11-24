import { handler, requireFarm } from "@/server/route";
import { saveSIS } from "@/server/services/slips";

/** Farm and Prepared by come from the session, never from the form. */
export const POST = handler("user", async ({ body, user }) => {
  const b = await body();
  return saveSIS({ ...b, farmId: requireFarm(user, b.farmId), preparedBy: user.name });
});
