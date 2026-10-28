"use client";

import { SlipForm, type BaseInput, type BuiltInput, type SlipFormData } from "@/components/slip/slip-form";
import { SlipHeader } from "@/components/slip/slip-header";
import { SlipLines, type LineCol } from "@/components/slip/slip-lines";
import { Field, TextInput } from "@/components/ui/field";
import { api } from "@/lib/api";
import { isBlank, num, opt } from "../form-data";
import { OgpDestination } from "./ogp-destination";

const cols: LineCol[] = [
  { key: "item", label: "line.description", kind: "item", width: "2fr", required: true },
  { key: "unit", label: "line.unit", kind: "unit", width: "4.5rem" },
  { key: "qty", label: "line.qty", kind: "qty", width: "1fr", required: true },
  { key: "weight", label: "line.weight", kind: "weight", width: "0.8fr" },
];

/** F4 New Outward Gate Pass. Qty can't exceed stock. After saving → print view (the driver needs the pass). */
export function OgpForm() {
  return (
    <SlipForm slipType="OGP" build={buildOgp} save={api.saveOGP} afterSave="print">
      <SlipHeader type="OGP" />
      <section className="card mb-4 grid gap-4 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <OgpDestination />
        </div>
        <Field label="igp.driverName">
          <TextInput name="driverName" free />
        </Field>
        <Field label="ogp.vehicleNo">
          <TextInput name="vehicleNo" />
        </Field>
      </section>
      <SlipLines cols={cols} showStock rules={{ maxStock: true }} />
    </SlipForm>
  );
}

function buildOgp({ fields, lines }: SlipFormData, base: BaseInput): BuiltInput {
  const filled = lines.filter(([, r]) => !isBlank(r, ["item", "qty", "weight"]));
  const to =
    fields.toKind === "outside"
      ? { kind: "outside", ms: fields.ms ?? "", reason: fields.reason }
      : fields.toKind === "farm"
        ? { kind: "farm", farmId: fields.toFarm ?? "" }
        : { kind: undefined };
  return {
    input: {
      ...base,
      to,
      driverName: opt(fields.driverName),
      vehicleNo: opt(fields.vehicleNo),
      lines: filled.map(([, r]) => ({ itemId: r.item ?? "", qty: num(r.qty), weightKg: num(r.weight) })),
    },
    lineRows: filled.map(([row]) => row),
  };
}
