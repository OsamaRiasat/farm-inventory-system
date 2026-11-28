import type { UserInput } from "@/features/admin/user-schema";
import { handler } from "@/server/route";
import { saveUser } from "@/server/services/setup";

/** Edit a user's details (never the password: see ./password). */
export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) => {
  const input = (await body()) as UserInput;
  return saveUser({ ...input, password: undefined, id: params.id, by: user.name, byUserId: user.id });
});
