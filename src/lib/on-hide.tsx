"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Next.js keeps a page you leave alive (hidden, inside <Activity>), so typed data would still be there
 * when you come back by Back or by opening the same link. `fn` runs when the page is hidden (and on unmount).
 */
export function useOnHide(fn: () => void) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  useLayoutEffect(() => () => ref.current(), []);
}

/** Starts its children from scratch whenever the page is hidden: every field empty, every panel closed. */
export function ResetOnHide({ children }: { children: ReactNode }) {
  const [key, setKey] = useState(0);
  useOnHide(() => setKey((k) => k + 1));
  return <Fragment key={key}>{children}</Fragment>;
}
