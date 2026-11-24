import { cookies } from "next/headers";
import { login, SESSION_COOKIE, toSession, userFromToken } from "@/server/auth";
import { errorResponse } from "@/server/route";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const session = await login(String(b.username ?? ""), String(b.password ?? ""));
  if (!session) return errorResponse(400, "err.wrongLogin");
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: session.expiresAt,
  });
  const user = await userFromToken(session.token);
  return Response.json(user ? toSession(user) : null);
}
