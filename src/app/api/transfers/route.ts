import { farmFor, handler } from "@/server/route";
import { listTransfers } from "@/server/services/transfers";

export const GET = handler("user", ({ query, user }) => listTransfers({ farmId: farmFor(user, query.get("farmId")) }));
