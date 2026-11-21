"use client";

import { useEffect, useId, useRef } from "react";
import { registerLeavePrompt } from "@/lib/leave-guard";
import { Bi } from "./bi";

/** "Leave without saving?" for the Back link, shortcuts and anything else that uses requestLeave. One per slip screen. */
export function LeavePrompt() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<(() => void) | null>(null);
  const titleId = useId();

  useEffect(() => {
    registerLeavePrompt((leave) => {
      leaveRef.current = leave;
      dialogRef.current?.showModal();
      stayRef.current?.focus();
    });
    return () => registerLeavePrompt(null);
  }, []);

  return (
    <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
      <div className="p-4">
        <h2 id={titleId} className="text-lg font-semibold">
          <Bi id="leave.title" />
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button ref={stayRef} type="button" className="btn btn-primary" onClick={() => dialogRef.current?.close()}>
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
  );
}
