import { handler, requireFarm } from "@/server/route";
import { saveDR } from "@/server/services/slips";

/** Daily Report (T07). Farm and Prepared by come from the session, never from the form. */
export const POST = handler("user", async ({ body, user }) => {
  const b = await body();
  return saveDR({ ...b, farmId: requireFarm(user, b.farmId), preparedBy: user.name });
});
