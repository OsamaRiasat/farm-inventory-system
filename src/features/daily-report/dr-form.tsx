"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { QtyInput } from "@/components/slip/qty-input";
import { RemarksField } from "@/components/slip/remarks-field";
import { SlipHeader } from "@/components/slip/slip-header";
import { SlipForm, type BaseInput, type BuiltInput, type SlipFormData } from "@/components/slip/slip-form";
import { useSlipErrors } from "@/components/slip/slip-errors";
import { api } from "@/lib/api";
import { useSlips } from "@/lib/api/queries";
import { today } from "@/lib/dates";
import { fmtQty, parseQty } from "@/lib/format";
import { type MsgId } from "@/lib/i18n";
import { slipNo } from "@/lib/slips";
import { toFieldErrors } from "@/lib/validation";
import { num, opt } from "../form-data";
import { DR_COUNTS, drSchema, eggsToStock, type DrCount } from "./schema";

const EGGS: { key: DrCount; label: MsgId; required?: boolean }[] = [
  { key: "eggsReceived", label: "dr.eggsReceived", required: true },
  { key: "hatchingEggs", label: "dr.hatchingEggs" },
  { key: "marketEggs", label: "dr.marketEggs" },
  { key: "discardedEggs", label: "dr.discardedEggs" },
];
const ASSETS: { key: DrCount; label: MsgId }[] = [
  { key: "gattaTray", label: "dr.gattaTray" },
  { key: "plasticTray", label: "dr.plasticTray" },
  { key: "eggsBox", label: "dr.eggsBox" },
];

/**
 * T07 Daily Report: eggs received and where they went, plus trays and boxes. One per farm per date.
 * Only "Eggs added to stock" (Total − Hatching − Market − Discarded) changes stock; it is worked out live here
 * and again on the server. Enter → next field, Ctrl/⌘+S saves (SlipForm); the rules run before the save call.
 */
export function DrForm() {
  const { farm } = useCurrentFarm();
  // This farm's Daily Reports, so "already saved for this date" shows before the save call (the server checks too).
  const reports = useSlips({ farmId: farm.id, type: "DR" }).data ?? [];

  function validate(input: unknown) {
    const reportOn = (date: string) => {
      const hit = reports.find((r) => r.date === date && r.status !== "cancelled" && !r.correctionOf);
      return hit ? slipNo(hit) : undefined;
    };
    const result = drSchema({ item: () => undefined, stockOf: () => 0, today: today(), reportOn }).safeParse(input);
    return result.success ? [] : toFieldErrors(result.error);
  }

  return (
    <SlipForm slipType="DR" build={buildDr} save={api.saveDR} validate={validate}>
      <DrFields />
    </SlipForm>
  );
}

function buildDr({ fields }: SlipFormData, base: BaseInput): BuiltInput {
  const counts = Object.fromEntries(DR_COUNTS.map((k) => [k, num(fields[k])]));
  return { input: { ...base, ...counts, remarks: opt(fields.remarks) }, lineRows: [] };
}

/** The fields, inside the form (so a saved or hidden form starts empty again). */
function DrFields() {
  const [values, setValues] = useState<Record<DrCount, string>>(() => Object.fromEntries(DR_COUNTS.map((k) => [k, ""])) as Record<DrCount, string>);
  const n = (k: DrCount) => parseQty(values[k]) ?? 0;
  const toStock = eggsToStock({ eggsReceived: n("eggsReceived"), hatchingEggs: n("hatchingEggs"), marketEggs: n("marketEggs"), discardedEggs: n("discardedEggs") });
  const over = toStock < 0;
  const set = (k: DrCount) => (v: string) => setValues((old) => ({ ...old, [k]: v }));

  return (
    <>
      <SlipHeader type="DR" />
      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-semibold">
          <Bi id="dr.eggs" />
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {EGGS.map(({ key, label, required }) => (
            <CountField key={key} name={key} label={label} required={required} value={values[key]} onChange={set(key)} />
          ))}
        </div>
        <div
          data-to-stock
          aria-live="polite"
          className={clsx("mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border p-3", over ? "border-danger bg-danger-bg" : "border-primary bg-success-bg")}
        >
          <span>
            <Bi id="dr.toStock" className="font-semibold" />
            <span className="block text-sm text-muted">
              <Bi id="dr.toStockHint" inline />
            </span>
          </span>
          <span className={clsx("num text-xl font-semibold", over ? "text-danger" : "text-primary")}>
            {fmtQty(Math.max(toStock, 0))} <Bi id="dr.nos" inline />
          </span>
          {over && (
            <span className="w-full text-sm font-medium text-danger">
              <Bi
                id="err.drEggsOver"
                values={{ n: fmtQty(n("hatchingEggs") + n("marketEggs") + n("discardedEggs")), total: fmtQty(n("eggsReceived")) }}
                inline
              />
            </span>
          )}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="font-semibold">
          <Bi id="dr.currentAssets" />
        </h2>
        <p className="mb-3 text-sm text-muted">
          <Bi id="dr.traysNote" inline />
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {ASSETS.map(({ key, label }) => (
            <CountField key={key} name={key} label={label} value={values[key]} onChange={set(key)} />
          ))}
        </div>
      </section>

      <RemarksField />
    </>
  );
}

/** One count: whole number, "Nos" inside the box, the rule's error underneath. Blank = 0, except Total. */
function CountField({
  name,
  label,
  required,
  value,
  onChange,
}: {
  name: DrCount;
  label: MsgId;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const error = useSlipErrors().find((e) => e.path[0] === name);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-start gap-1 text-sm font-medium">
        <Bi id={label} />
        {required && (
          <span className="text-danger" aria-hidden>
            *
          </span>
        )}
      </span>
      <QtyInput
        name={name}
        inputMode="numeric"
        placeholder={required ? undefined : "0"}
        suffix="Nos"
        value={value}
        onChange={onChange}
        invalid={!!error}
      />
      {error && (
        <span className="text-sm font-medium text-danger">
          <Bi id={error.id} values={error.values} inline />
        </span>
      )}
    </label>
  );
}
