import { handler } from "@/server/route";
import { listFarms } from "@/server/services/setup";

export const GET = handler("user", () => listFarms());
