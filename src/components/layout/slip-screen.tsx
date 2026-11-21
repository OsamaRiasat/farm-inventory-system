"use client";

import { type ReactNode } from "react";
import { BackLink } from "./back-link";
import { useCurrentFarm } from "./farm-gate";
import { LangOrderToggle } from "./lang-order-toggle";
import { LeavePrompt } from "./leave-prompt";

/** Frame for one slip (F2–F5): back link + farm, no tab bar so the sticky Save owns the bottom. */
export function SlipScreen({ children, backHref = "/farm" }: { children: ReactNode; backHref?: string }) {
  const { farm } = useCurrentFarm();

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center lg:max-w-5xl justify-between gap-3 px-4 py-2">
          <BackLink href={backHref} />
          <div className="flex items-center gap-3">
            <span className="font-semibold">{farm.name}</span>
            <LangOrderToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4 lg:max-w-5xl">{children}</main>
      <LeavePrompt />
    </>
  );
}
