"use client";

import { useSyncExternalStore } from "react";

// The farm chosen in the admin top bar ("" = all farms). Applies to every admin screen; kept per tab.

const KEY = "awfarms.adminFarm";
const EVENT = "awfarms-admin-farm";

function read() {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function setAdminFarm(farmId: string) {
  try {
    sessionStorage.setItem(KEY, farmId);
  } catch {
    // Kept only until reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAdminFarm() {
  return useSyncExternalStore(subscribe, read, () => "");
}
