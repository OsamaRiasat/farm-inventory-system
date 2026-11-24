import { handler, requireFarm } from "@/server/route";
import { saveStockCount } from "@/server/services/stock-counts";

export const POST = handler("user", async ({ body, user }) => {
  const b = await body();
  return saveStockCount({ ...b, farmId: requireFarm(user, b.farmId), preparedBy: user.name });
});
