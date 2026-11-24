import { handler } from "@/server/route";
import { listUsers } from "@/server/services/setup";

export const GET = handler("admin", () => listUsers());
