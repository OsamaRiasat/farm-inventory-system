// In-memory mock database, saved to localStorage so the demo survives a reload.
// Browser only: the mock API must never run on the server.

import type { MockState } from "./engine";
import { buildSeed, MOCK_VERSION } from "./seed";

const KEY = "awfarms.mock.v1";

let state: MockState | null = null;
const listeners = new Set<() => void>();

function assertBrowser() {
  if (typeof window === "undefined") throw new Error("The mock API runs in the browser only.");
}

function load(): MockState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockState;
    return parsed.version === MOCK_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the demo keeps working until reload.
  }
}

export function getState(): MockState {
  assertBrowser();
  if (!state) {
    state = load();
    if (!state) {
      state = buildSeed(new Date());
      persist();
    }
  }
  return state;
}

/** Writes are applied to a copy and swapped in only if they succeed, so a failed save changes nothing. */
export function update<T>(fn: (draft: MockState) => T): T {
  const draft = structuredClone(getState());
  const result = fn(draft);
  state = draft;
  persist();
  return result;
}

export function resetState() {
  assertBrowser();
  state = buildSeed(new Date());
  persist();
}

/** Fires when another tab changes the demo data (e.g. a farm saves while the admin tab is open). */
export function onExternalChange(listener: () => void) {
  assertBrowser();
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY) return;
  state = null;
  listeners.forEach((l) => l());
}
