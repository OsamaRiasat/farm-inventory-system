"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Keeps the browser history short: going "up" (Back link, g h) returns to the page we came from
// instead of stacking another copy of it, so the phone's Back button never walks through old slips.

type Router = { back: () => void; replace: (href: string) => void };

let current: string | null = null;
let previous: string | null = null;

/** Mounted once in the farm layout (inside <Suspense>): remembers the last two in-app pages. */
export function NavTracker() {
  const path = usePathname();
  useEffect(() => {
    if (path === current) return;
    previous = current;
    current = path;
  }, [path]);
  return null;
}

/** Back to `href` if that's where we came from; otherwise replace this page with it. */
export function goUp(router: Router, href: string) {
  if (previous === href) router.back();
  else router.replace(href);
}
