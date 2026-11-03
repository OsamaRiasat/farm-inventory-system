"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { slipTypeStyle, TypeChip } from "@/components/layout/type-chip";
import { addDays } from "@/lib/dates";
import { useClock } from "@/lib/use-clock";
import { MAX_DAYS_BACK } from "@/lib/validation";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import type { SlipType } from "@/types/domain";
import { useSlipErrors } from "./slip-errors";

/**
 * C4 slip header: bilingual title, No. (the paper slip's number, typed), Farm / Hatchery, Posted on (automatic),
 * the slip's own date (arrival / dispatch / issue — up to 30 days back) and Time — the same on every slip.
 */
export function SlipHeader({ type, subtitle }: { type: SlipType; subtitle?: ReactNode }) {
  const posted = useClock("date");
  const { farm } = useCurrentFarm();

  return (
    <section className={clsx("card mb-4 border-l-4 p-4", slipTypeStyle[type].border)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="flex flex-col gap-1">
          <TypeChip type={type} className="self-start" />
          <Bi id={`slip.${type}`} className="text-xl font-semibold" />
          {subtitle}
        </h1>
        <PaperNoField type={type} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">
            <Bi id="slip.farm" />
          </dt>
          <dd className="font-medium">{farm.code}</dd>
        </div>
        <div>
          <dt className="text-muted">
            <Bi id="slip.postedOn" />
          </dt>
          <dd className="num font-medium">{posted}</dd>
        </div>
        <div>
          <dt className="text-muted">
            <label htmlFor="slip-date">
              <Bi id={`slip.date${type}`} />
            </label>
          </dt>
          <dd>
            <DateField />
          </dd>
        </div>
        <div>
          <dt className="text-muted">
            <Bi id="slip.time" />
          </dt>
          <dd>
            <TimeField />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function FieldError({ path }: { path: string }) {
  const error = useSlipErrors().find((e) => e.path.join(".") === path);
  if (!error) return null;
  return (
    <span className="text-sm font-medium text-danger">
      <Bi id={error.id} values={error.values} inline />
    </span>
  );
}

/** "No. IGP-____": the farm types the number from its paper slip book. Submitted as "paperNo". */
function PaperNoField({ type }: { type: SlipType }) {
  const invalid = useSlipErrors().some((e) => e.path[0] === "paperNo");
  return (
    <div className="flex flex-col items-end gap-1">
      <label htmlFor="slip-paper-no" className="flex gap-1 text-sm text-muted">
        <Bi id="slip.no" />
        <span className="text-danger" aria-hidden>
          *
        </span>
      </label>
      <div className="flex">
        <span className="num flex items-center rounded-l-lg border border-r-0 border-line-strong bg-surface-2 px-3 font-semibold">
          {type}-
        </span>
        <input
          id="slip-paper-no"
          name="paperNo"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          required
          aria-invalid={invalid || undefined}
          className={clsx("input num w-32 rounded-l-none", invalid && "border-2 border-danger")}
        />
      </div>
      <FieldError path="paperNo" />
    </div>
  );
}

/** The slip's date: today by default, can go back up to 30 days, never ahead. Submitted as "date". */
function DateField() {
  const iso = useClock("iso");
  const invalid = useSlipErrors().some((e) => e.path[0] === "date");
  return (
    <span className="flex flex-col gap-1">
      <input
        key={iso}
        id="slip-date"
        type="date"
        name="date"
        defaultValue={iso}
        min={iso ? addDays(iso, -MAX_DAYS_BACK) : undefined}
        max={iso || undefined}
        aria-invalid={invalid || undefined}
        className={clsx("input num min-h-10 w-auto", invalid && "border-2 border-danger")}
      />
      <FieldError path="date" />
    </span>
  );
}

/** Time is automatic; "change" allows another time. Submitted as the form field "time". */
function TimeField() {
  const now = useClock("time");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <input type="time" name="time" defaultValue={now} autoFocus className="input num min-h-10 w-32" aria-label="Time" />;
  }
  return (
    <span className="flex min-h-10 items-center gap-2">
      <input type="hidden" name="time" value={now} />
      <span className="num font-medium">{now}</span>
      <button type="button" data-enter-skip className="text-primary underline" onClick={() => setEditing(true)}>
        <Bi id="slip.change" inline />
      </button>
    </span>
  );
}
