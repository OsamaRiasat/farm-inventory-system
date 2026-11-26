"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { SIGNED_OUT_EVENT } from "@/lib/api/http";
import { forgetSlipDates } from "./slip-date";

// Who is signed in, from the server's session cookie (GET /api/me). The gates (FarmGate, AdminGate) send
// anyone signed out to the login; an API call answered "signed out" clears this at once.

export type Session = { role: "farm"; farmId: string; userName: string } | { role: "admin"; userName: string };

export const SESSION_KEY = ["me"] as const;

async function fetchMe(): Promise<Session | null> {
  const res = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error(`/api/me ${res.status}`);
  return (await res.json()) as Session | null;
}

/** undefined while loading, null when nobody is signed in. */
export function useSession(): Session | null | undefined {
  const client = useQueryClient();
  const { data } = useQuery({ queryKey: SESSION_KEY, queryFn: fetchMe, staleTime: Infinity, retry: 2 });

  useEffect(() => {
    const signedOut = () => client.setQueryData(SESSION_KEY, null);
    window.addEventListener(SIGNED_OUT_EVENT, signedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signedOut);
  }, [client]);

  return data;
}

/** Signs in; returns the session, or null for a wrong username / password. */
export async function signIn(username: string, password: string): Promise<Session | null> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "same-origin",
  });
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`login ${res.status}`);
  return (await res.json()) as Session;
}

export async function signOut() {
  forgetSlipDates();
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}
