"use client";

import { Bi } from "@/components/layout/bi";
import type { MsgId } from "@/lib/i18n";

type Option<V extends string> = { value: V; label: MsgId };

/**
 * Native radio group styled as a segmented control or chips.
 * Keyboard comes free: one Tab stop, ← / → to switch.
 */
export function Segmented<V extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  required,
}: {
  name: string;
  legend: MsgId;
  options: Option<V>[];
  value: V | null;
  onChange: (value: V) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 flex items-start gap-1 text-sm font-medium">
        <Bi id={legend} />
        {required && (
          <span className="text-danger" aria-hidden>
            *
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              required={required}
              className="peer sr-only"
            />
            <span className="flex min-h-12 items-center rounded-lg border border-line-strong bg-surface px-4 peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-semibold peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              <Bi id={o.label} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
