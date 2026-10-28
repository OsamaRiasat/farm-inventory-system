"use client";

import { useSyncExternalStore } from "react";

// Phase 1 mock login. Kept per browser tab (sessionStorage), so one tab can be a farm and another
// the Accounts Admin during a demo. The real backend replaces this with proper sign-in.

export type Session = { role: "farm"; farmId: string; userName: string } | { role: "admin"; userName: string };

const KEY = "awfarms.session";
const EVENT = "awfarms-session";

let cachedRaw: string | null = null;
let cached: Session | null = null;

function read(): Session | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    // Blocked storage: signed out.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function setSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Blocked storage: the session can't be kept.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** undefined while rendering on the server, null when nobody is signed in. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
