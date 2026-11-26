"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { slipTypeStyle, TypeChip } from "@/components/layout/type-chip";
import { startDate } from "@/lib/slip-date";
import { useClock } from "@/lib/use-clock";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import type { SlipType } from "@/types/domain";
import { useSlipErrors } from "./slip-errors";

/**
 * C4 slip header: bilingual title, No. (the paper slip's number, typed), Farm / Hatchery, Posted on (automatic),
 * the slip's own date (arrival / dispatch / issue — any past date, never ahead) and Time — the same on every slip.
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
            <DateField farmId={farm.id} />
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

/**
 * The slip's date: any earlier date (previous months too), never ahead. Submitted as "date".
 * Starts at the date of the last slip saved in this tab (client #27), else today; "Not today" when it differs.
 */
function DateField({ farmId }: { farmId: string }) {
  const iso = useClock("iso");
  const invalid = useSlipErrors().some((e) => e.path[0] === "date");
  const start = iso ? startDate(farmId, iso) : "";
  const [picked, setPicked] = useState<string | null>(null);
  const value = picked ?? start;
  return (
    <span className="flex flex-col gap-1">
      <input
        key={iso + start}
        id="slip-date"
        type="date"
        name="date"
        defaultValue={start}
        onChange={(e) => setPicked(e.target.value)}
        max={iso || undefined}
        aria-invalid={invalid || undefined}
        className={clsx("input num min-h-10 w-auto", invalid && "border-2 border-danger")}
      />
      {iso && value && value !== iso && (
        <span className="text-sm font-medium text-warning">
          <Bi id="slip.notToday" inline />
        </span>
      )}
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
