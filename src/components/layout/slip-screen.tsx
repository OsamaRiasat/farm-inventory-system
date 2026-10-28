"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { registerLeavePrompt, requestLeave } from "@/lib/leave-guard";
import { Bi } from "./bi";
import { useCurrentFarm } from "./farm-gate";
import { LangOrderToggle } from "./lang-order-toggle";

/** Frame for one slip (F2–F5): back link + farm, no tab bar so the sticky Save owns the bottom. */
export function SlipScreen({ children, backHref = "/farm" }: { children: ReactNode; backHref?: string }) {
  const { farm } = useCurrentFarm();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const leaveRef = useRef<(() => void) | null>(null);
  const titleId = useId();

  // "Leave without saving?" for the Back link, shortcuts and anything else that uses requestLeave.
  useEffect(() => {
    registerLeavePrompt((leave) => {
      leaveRef.current = leave;
      dialogRef.current?.showModal();
    });
    return () => registerLeavePrompt(null);
  }, []);

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link
            href={backHref}
            className="-ml-2 flex min-h-12 items-center gap-1 px-2 text-primary"
            onClick={(e) => {
              e.preventDefault();
              requestLeave(() => router.push(backHref));
            }}
          >
            <ChevronLeft size={22} aria-hidden />
            <Bi id="nav.back" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-semibold">{farm.name}</span>
            <LangOrderToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>

      <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
        <div className="p-4">
          <h2 id={titleId} className="text-lg font-semibold">
            <Bi id="leave.title" />
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" className="btn btn-primary" autoFocus onClick={() => dialogRef.current?.close()}>
              <Bi id="leave.stay" inline />
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                dialogRef.current?.close();
                leaveRef.current?.();
              }}
            >
              <Bi id="leave.leave" inline />
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
