"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { slipTypeStyle, TypeChip } from "@/components/layout/type-chip";
import { useClock } from "@/lib/use-clock";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import type { SlipType } from "@/types/domain";

/** C4 slip header: bilingual title, No., Farm / Hatchery, Date, Time — the same on every slip. */
export function SlipHeader({ type, subtitle }: { type: SlipType; subtitle?: ReactNode }) {
  const date = useClock("date");
  const { farm } = useCurrentFarm();

  return (
    <section className={clsx("card mb-4 border-l-4 p-4", slipTypeStyle[type].border)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="flex flex-col gap-1">
          <TypeChip type={type} className="self-start" />
          <Bi id={`slip.${type}`} className="text-xl font-semibold" />
          {subtitle}
        </h1>
        <div className="text-right">
          <Bi id="slip.no" className="text-sm text-muted" />
          <div className="font-semibold">
            <Bi id="slip.new" />
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">
            <Bi id="slip.farm" />
          </dt>
          <dd className="font-medium">{farm.code}</dd>
        </div>
        <div>
          <dt className="text-muted">
            <Bi id="slip.date" />
          </dt>
          <dd className="num font-medium">{date}</dd>
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

/** Time is automatic; "change" allows a later-same-day entry. Submitted as the form field "time". */
function TimeField() {
  const now = useClock("time");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <input type="time" name="time" defaultValue={now} autoFocus className="input num min-h-10 w-32" aria-label="Time" />;
  }
  return (
    <span className="flex items-center gap-2">
      <input type="hidden" name="time" value={now} />
      <span className="num font-medium">{now}</span>
      <button type="button" className="text-primary underline" onClick={() => setEditing(true)}>
        <Bi id="slip.change" inline />
      </button>
    </span>
  );
}
