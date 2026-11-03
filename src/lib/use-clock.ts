"use client";

import { useSyncExternalStore } from "react";
import { isoDate } from "@/lib/dates";

const subscribe = () => () => {};

/** Today's date ("27 Oct 2026"), ISO date ("2026-10-27") or time ("10:40") in the browser; empty during server render. */
export function useClock(part: "date" | "iso" | "time") {
  return useSyncExternalStore(
    subscribe,
    () => {
      const now = new Date();
      if (part === "iso") return isoDate(now);
      return part === "date"
        ? now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    },
    () => "",
  );
}
