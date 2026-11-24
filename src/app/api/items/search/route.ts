import { handler } from "@/server/route";
import { searchItems } from "@/server/services/setup";

export const GET = handler("user", ({ query }) => searchItems(query.get("q") ?? ""));
