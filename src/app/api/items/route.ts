import { handler } from "@/server/route";
import { listItems, saveItem, type ItemInput } from "@/server/services/setup";

export const GET = handler("user", () => listItems());
export const POST = handler("admin", async ({ body, user }) => saveItem({ ...((await body()) as ItemInput), by: user.name }));
