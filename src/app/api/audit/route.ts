import { farmFor, handler } from "@/server/route";
import { listAudit } from "@/server/services/dashboard";

/** Admin: any farm or all. Farm User: their own farm's entries (F7 shows who corrected or cancelled a slip, and why). */
export const GET = handler("user", ({ query, user }) => listAudit({ farmId: farmFor(user, query.get("farmId")) }));
