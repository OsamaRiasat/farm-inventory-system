import { cookies } from "next/headers";
import { logout, SESSION_COOKIE } from "@/server/auth";

export async function POST() {
  const jar = await cookies();
  await logout(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return Response.json(null);
}
