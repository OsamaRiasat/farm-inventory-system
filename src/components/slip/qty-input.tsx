"use client";

import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";
import { fmtQty, parseQty } from "@/lib/format";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** Unit shown inside the field, fixed. */
  suffix?: string;
  decimals?: boolean;
  invalid?: boolean;
};

/** C2 quantity input: digits only, numeric keypad, thousands separators added on blur. */
export function QtyInput({ value, onChange, suffix, decimals, invalid, className, ...rest }: Props) {
  return (
    <div className="input-wrap">
      <input
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        enterKeyHint="next"
        autoComplete="off"
        {...rest}
        className={clsx("input input-num", invalid && "border-2 border-danger", className)}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(decimals ? /[^\d.,]/g : /[^\d,]/g, ""))}
        onBlur={() => {
          const n = parseQty(value);
          if (n !== null) onChange(fmtQty(n));
        }}
      />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
  );
}
