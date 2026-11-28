// Sign-in with username + password; the session is a random token in an httpOnly cookie, stored hashed.

import { createHash, randomBytes } from "node:crypto";
import type { Session } from "@/lib/session";
import { db } from "./db";
import { checkPassword } from "./password";

export const SESSION_COOKIE = "awfarms_session";
const SESSION_DAYS = 30;

export type SessionUser = { id: string; name: string; role: "farm" | "admin"; farmId: string | null };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** The Session row id for a cookie token. */
export const sessionIdOf = hash;

/** Returns a new session token, or null for a wrong username / password or an inactive user. */
export async function login(username: string, password: string) {
  const user = await db().user.findUnique({ where: { username: username.trim().toLowerCase() } });
  // Compare even when the user is missing, so timing doesn't tell which usernames exist.
  const ok = await checkPassword(password, user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok || !user.active) return null;
  if (user.role === "farm" && !user.farmId) return null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db().session.create({ data: { id: hash(token), userId: user.id, expiresAt } });
  return { token, expiresAt };
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db().session.findUnique({ where: { id: hash(token) }, include: { user: true } });
  if (!row || row.expiresAt < new Date() || !row.user.active) return null;
  return { id: row.user.id, name: row.user.name, role: row.user.role, farmId: row.user.farmId };
}

export async function logout(token: string | undefined) {
  if (token) await db().session.deleteMany({ where: { id: hash(token) } });
}

/** What the browser gets from /api/me (same shape the screens used in phase 1). */
export function toSession(user: SessionUser): Session {
  return user.role === "farm" ? { role: "farm", farmId: user.farmId!, userName: user.name } : { role: "admin", userName: user.name };
}
