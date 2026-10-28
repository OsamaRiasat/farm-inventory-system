"use client";

import { useEffect, useRef } from "react";
import { isTyping } from "./focus";

/** Single-key page shortcut ("1", "/", "?"). Ignored while the user is typing in a field. */
export function useShortcut(key: string, handler: () => void) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
      if (e.key !== key) return;
      e.preventDefault();
      handlerRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key]);
}

/** Two-key page shortcut such as "g h" (press g, then h within a second). Ignored while typing. */
export function useKeySequence(sequence: string, handler: () => void) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const [first, second] = sequence.split(" ");
    let armedAt = 0;
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
      if (e.key === second && Date.now() - armedAt < 1000) {
        e.preventDefault();
        armedAt = 0;
        handlerRef.current();
      } else {
        armedAt = e.key === first ? Date.now() : 0;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sequence]);
}

/** Ctrl/⌘ + S and Ctrl/⌘ + Enter anywhere on the page. */
export function useSaveShortcut(onSave: () => void) {
  const saveRef = useRef(onSave);

  useEffect(() => {
    saveRef.current = onSave;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.defaultPrevented) return;
      if (e.key.toLowerCase() !== "s" && e.key !== "Enter") return;
      e.preventDefault();
      saveRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
