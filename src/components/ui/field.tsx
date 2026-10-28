"use client";

import { clsx } from "clsx";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { useSlipErrors } from "@/components/slip/slip-errors";
import type { MsgId } from "@/lib/i18n";

/** Label above its control, bilingual, with a required marker and the save error for `errorPath`. */
export function Field({
  label,
  required,
  hint,
  errorPath,
  className,
  children,
}: {
  label: MsgId;
  required?: boolean;
  hint?: ReactNode;
  /** API path of this field, e.g. "source.ms" or "to.farmId". */
  errorPath?: string;
  className?: string;
  children: ReactNode;
}) {
  const error = useSlipErrors().find((e) => errorPath && e.path.join(".") === errorPath);
  return (
    <label className={clsx("flex flex-col gap-1", className)}>
      <span className="flex items-start gap-1 text-sm font-medium">
        <Bi id={label} />
        {required && (
          <span className="text-danger" aria-hidden>
            *
          </span>
        )}
      </span>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
      {error && (
        <span className="text-sm font-medium text-danger">
          <Bi id={error.id} values={error.values} inline />
        </span>
      )}
    </label>
  );
}

/** Plain text input. `free` = may be typed in Urdu, so direction follows the text. */
export function TextInput({ free, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { free?: boolean }) {
  return (
    <input
      type="text"
      autoComplete="off"
      enterKeyHint="next"
      dir={free ? "auto" : undefined}
      className={clsx("input", className)}
      {...props}
    />
  );
}
