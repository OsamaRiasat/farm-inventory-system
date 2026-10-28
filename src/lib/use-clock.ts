"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Today's date ("27 Oct 2026") or time ("10:40") in the browser; empty during server render. */
export function useClock(part: "date" | "time") {
  return useSyncExternalStore(
    subscribe,
    () => {
      const now = new Date();
      return part === "date"
        ? now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    },
    () => "",
  );
}
