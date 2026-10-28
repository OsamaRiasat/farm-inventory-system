"use client";

import { useSyncExternalStore } from "react";
import { Bi } from "./bi";

const EVENT = "langorderchange";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

const isUrduFirst = () => document.documentElement.dataset.langOrder === "ur";

export function LangOrderToggle() {
  const urduFirst = useSyncExternalStore(subscribe, isUrduFirst, () => false);

  function toggle() {
    const next = urduFirst ? "en" : "ur";
    document.documentElement.dataset.langOrder = next;
    try {
      localStorage.setItem("langOrder", next);
    } catch {
      // Storage blocked: the order still applies until reload.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button type="button" className="btn min-h-10 px-3 text-sm" aria-pressed={urduFirst} onClick={toggle}>
      <Bi id="lang.urduFirst" inline />
    </button>
  );
}
