import { handler } from "@/server/route";
import { listSuppliers } from "@/server/services/setup";

export const GET = handler("user", () => listSuppliers());
