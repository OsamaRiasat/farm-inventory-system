import { handler, requireFarm } from "@/server/route";
import { listWaitingTransfers } from "@/server/services/transfers";

export const GET = handler("user", ({ query, user }) => listWaitingTransfers(requireFarm(user, query.get("farmId"))));
