"use client";

import { useRouter } from "next/navigation";
import { useShortcut } from "@/lib/keyboard/use-shortcut";

/** Farm home: 1 / 2 / 3 / 4 open IGP, OGP, SIS and the Daily Report. */
export function HomeShortcuts() {
  const router = useRouter();
  useShortcut("1", () => router.push("/farm/igp/new"));
  useShortcut("2", () => router.push("/farm/ogp/new"));
  useShortcut("3", () => router.push("/farm/sis/new"));
  useShortcut("4", () => router.push("/farm/dr/new"));
  return null;
}
