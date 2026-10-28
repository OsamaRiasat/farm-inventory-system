"use client";

// "Leave without saving?" — one guard for the whole app. A slip form marks itself dirty;
// anything that navigates away in-app (Back link, g h shortcut) asks first via requestLeave.

let dirty = false;
let ask: ((leave: () => void) => void) | null = null;

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
}

export function setDirty(value: boolean) {
  if (value === dirty) return;
  dirty = value;
  if (dirty) window.addEventListener("beforeunload", onBeforeUnload);
  else window.removeEventListener("beforeunload", onBeforeUnload);
}

/** The screen that can show the question registers here (SlipScreen). */
export function registerLeavePrompt(prompt: ((leave: () => void) => void) | null) {
  ask = prompt;
}

/** Leave now if nothing is typed; otherwise ask, and leave only on "Leave". */
export function requestLeave(leave: () => void) {
  if (dirty && ask) ask(() => {
    setDirty(false);
    leave();
  });
  else leave();
}
