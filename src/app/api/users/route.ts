import type { UserInput } from "@/features/admin/user-schema";
import { handler } from "@/server/route";
import { listUsers, saveUser } from "@/server/services/setup";

export const GET = handler("admin", () => listUsers());
/** Add a user. The id in the body is ignored: editing goes to /api/users/[id]. */
export const POST = handler("admin", async ({ body, user }) =>
  saveUser({ ...((await body()) as UserInput), id: undefined, by: user.name, byUserId: user.id }),
);
