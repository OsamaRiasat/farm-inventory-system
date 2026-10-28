"use client";

import { useRouter } from "next/navigation";
import { useId, useRef } from "react";
import type { MsgId } from "@/lib/i18n";
import { useKeySequence, useShortcut } from "@/lib/keyboard/use-shortcut";
import { requestLeave } from "@/lib/leave-guard";
import { Bi } from "./bi";

const shortcuts: { keys: string[]; label: MsgId; area?: "farm" | "admin" }[] = [
  { keys: ["Enter"], label: "keys.next" },
  { keys: ["Enter"], label: "keys.newLine" },
  { keys: ["Alt", "N"], label: "keys.addLine" },
  { keys: ["Alt", "Backspace"], label: "keys.removeLine" },
  { keys: ["↑", "↓", "Enter"], label: "keys.pick" },
  { keys: ["Ctrl", "S"], label: "keys.save" },
  { keys: ["Esc"], label: "keys.close" },
  { keys: ["/"], label: "keys.search" },
  { keys: ["1", "2", "3"], label: "keys.slips123", area: "farm" },
  { keys: ["g h", "g s", "g k"], label: "keys.goTo", area: "farm" },
  { keys: ["↑", "↓", "Enter", "[", "]"], label: "keys.table", area: "admin" },
  { keys: ["?"], label: "keys.help" },
];

/** Page-wide keys: "?" opens this list, "/" focuses the screen's search, "g h / g s / g k" on farm screens. */
export function GlobalShortcuts({ area }: { area: "farm" | "admin" }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useShortcut("?", () => dialogRef.current?.showModal());
  useShortcut("/", () => document.querySelector<HTMLElement>("[data-search]")?.focus());
  const go = (href: string) => area === "farm" && requestLeave(() => router.push(href));
  useKeySequence("g h", () => go("/farm"));
  useKeySequence("g s", () => go("/farm/slips"));
  useKeySequence("g k", () => go("/farm/stock"));

  return (
    <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
      <div className="p-4">
        <h2 id={titleId} className="mb-3 text-lg font-semibold">
          <Bi id="keys.title" />
        </h2>
        <ul className="divide-y divide-line">
          {shortcuts
            .filter((s) => !s.area || s.area === area)
            .map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-4 py-2 text-sm">
                <Bi id={s.label} />
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
              </li>
            ))}
        </ul>
        <form method="dialog" className="mt-4 flex justify-end">
          <button className="btn" autoFocus>
            <Bi id="common.close" inline />
          </button>
        </form>
      </div>
    </dialog>
  );
}
