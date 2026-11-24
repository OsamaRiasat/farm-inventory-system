import { handler, requireFarm } from "@/server/route";
import { getStockCard } from "@/server/services/stock";

export const GET = handler("user", ({ query, user }) => getStockCard(requireFarm(user, query.get("farmId")), query.get("itemId") ?? ""));
