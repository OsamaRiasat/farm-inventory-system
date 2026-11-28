import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionIdOf } from "@/server/auth";
import { handler } from "@/server/route";
import { setUserPassword } from "@/server/services/setup";

/** Set a new password; the user is signed out everywhere (the Admin's own current session stays). */
export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return setUserPassword({
    id: params.id,
    password: String((await body()).password ?? ""),
    by: user.name,
    keepSessionId: token && params.id === user.id ? sessionIdOf(token) : undefined,
  });
});
