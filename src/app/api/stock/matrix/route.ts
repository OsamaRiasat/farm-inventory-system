import { handler } from "@/server/route";
import { getStockMatrix } from "@/server/services/stock";

export const GET = handler("admin", () => getStockMatrix());
