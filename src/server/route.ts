// Shared wrapper for /api route handlers: sign-in check → role check → service → JSON.
// Errors go back as { error: { id, values, fieldErrors } } and the browser rethrows them as ApiError.

import { cookies } from "next/headers";
import { ApiError } from "@/lib/api/errors";
import { SESSION_COOKIE, userFromToken, type SessionUser } from "./auth";

/** A Farm User asking for another farm's data. Answered as "not found", so nothing leaks. */
export class Forbidden extends Error {}

export type Ctx<P> = { req: Request; params: P; user: SessionUser; query: URLSearchParams; body: () => Promise<Record<string, unknown>> };

export function errorResponse(status: number, id: string, values?: unknown, fieldErrors?: unknown) {
  return Response.json({ error: { id, values, fieldErrors } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function currentUser() {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export function handler<P = Record<string, never>>(role: "user" | "admin", fn: (c: Ctx<P>) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    // Outside the try: during the build Next.js stops here on purpose (the route is dynamic).
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    try {
      const user = await userFromToken(token);
      if (!user) return errorResponse(401, "err.signedOut");
      if (role === "admin" && user.role !== "admin") return errorResponse(404, "err.notFound");
      const result = await fn({
        req,
        params: await ctx.params,
        user,
        query: new URL(req.url).searchParams,
        body: async () => {
          const v = await req.json().catch(() => null);
          if (!v || typeof v !== "object" || Array.isArray(v)) throw new ApiError("err.required");
          return v as Record<string, unknown>;
        },
      });
      return Response.json(result ?? null, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.id === "err.notFound" ? 404 : 400, e.id, e.values, e.fieldErrors);
      if (e instanceof Forbidden) return errorResponse(404, "err.notFound");
      console.error(e);
      return errorResponse(500, "err.notSaved");
    }
  };
}

// ── permissions ──

/** The farm a request may act on: a Farm User only their own; the Admin any (or none = all farms). */
export function farmFor(user: SessionUser, requested: unknown): string | undefined {
  const farmId = typeof requested === "string" && requested ? requested : undefined;
  if (user.role === "admin") return farmId;
  if (farmId && farmId !== user.farmId) throw new Forbidden();
  return user.farmId!;
}

/** Same as farmFor, but a farm is required. */
export function requireFarm(user: SessionUser, requested: unknown): string {
  const farmId = farmFor(user, requested);
  if (!farmId) throw new ApiError("err.pickFarm");
  return farmId;
}

/** A Farm User may see their own farm's records, and the other side of a transfer with their farm. */
export function assertSees(user: SessionUser, farmIds: (string | undefined | null)[]) {
  if (user.role === "admin") return;
  if (!farmIds.includes(user.farmId)) throw new Forbidden();
}
