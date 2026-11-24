import { handler } from "@/server/route";
import { getDashboard } from "@/server/services/dashboard";

export const GET = handler("admin", () => getDashboard());
