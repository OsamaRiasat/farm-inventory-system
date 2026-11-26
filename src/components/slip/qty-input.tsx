"use client";

import { clsx } from "clsx";
import type { CSSProperties, InputHTMLAttributes } from "react";
import { fmtQty, parseQty } from "@/lib/format";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** Unit shown inside the field, fixed. */
  suffix?: string;
  invalid?: boolean;
  /** Hide the unit from 768px up, where the line table has its own Unit column. */
  suffixPhoneOnly?: boolean;
};

/** C2 quantity input: digits and one decimal point (any unit, client #21), thousands separators added on blur. */
export function QtyInput({ value, onChange, suffix, invalid, suffixPhoneOnly, className, ...rest }: Props) {
  return (
    <div className="input-wrap" style={suffix ? ({ "--suffix-len": suffix.length } as CSSProperties) : undefined}>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        {...rest}
        className={clsx(
          "input input-num",
          suffix && "input-has-suffix",
          suffix && suffixPhoneOnly && "md:pr-2",
          invalid && "border-2 border-danger",
          className,
        )}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={() => {
          const n = parseQty(value);
          if (n !== null) onChange(fmtQty(n));
        }}
      />
      {suffix && <span className={clsx("input-suffix", suffixPhoneOnly && "md:hidden")}>{suffix}</span>}
    </div>
  );
}
