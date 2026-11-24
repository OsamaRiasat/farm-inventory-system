import { toSession } from "@/server/auth";
import { currentUser } from "@/server/route";

/** The signed-in user (or null). Never cached. */
export async function GET() {
  const user = await currentUser();
  return Response.json(user ? toSession(user) : null, { headers: { "Cache-Control": "no-store" } });
}
