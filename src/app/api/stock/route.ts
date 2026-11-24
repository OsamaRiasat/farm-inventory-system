import { handler, requireFarm } from "@/server/route";
import { getStock } from "@/server/services/stock";

export const GET = handler("user", ({ query, user }) => getStock(requireFarm(user, query.get("farmId"))));
