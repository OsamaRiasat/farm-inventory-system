"use client";

import { tInline } from "@/lib/i18n";
import type { Farm } from "@/types/domain";

/** C8 farm picker: code + name. `allLabel` adds an "All farms" choice (value ""). */
export function FarmPicker({
  farms,
  value,
  onChange,
  includeAll,
  exclude,
  placeholder,
  name,
  required,
  autoFocus,
  className = "input",
  "aria-label": ariaLabel,
}: {
  farms: Farm[];
  value: string;
  onChange: (farmId: string) => void;
  includeAll?: boolean;
  exclude?: string;
  /** Shown first with value "" when nothing is picked yet. */
  placeholder?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <select
      name={name}
      className={className}
      value={value}
      required={required}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeAll && <option value="">{tInline("admin.allFarms")}</option>}
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {farms
        .filter((f) => f.active && f.id !== exclude)
        .map((f) => (
          <option key={f.id} value={f.id}>
            {f.name.startsWith(f.code) ? f.name : `${f.code} · ${f.name}`}
          </option>
        ))}
    </select>
  );
}
