"use client";

import { SlipForm, type BaseInput, type BuiltInput, type SlipFormData } from "@/components/slip/slip-form";
import { SlipHeader } from "@/components/slip/slip-header";
import { RemarksField } from "@/components/slip/remarks-field";
import { SlipLines, type LineCol } from "@/components/slip/slip-lines";
import { Field, TextInput } from "@/components/ui/field";
import { api } from "@/lib/api";
import { isBlank, num, opt } from "../form-data";
import { OgpDestination } from "./ogp-destination";

const cols: LineCol[] = [
  { key: "item", label: "line.description", kind: "item", width: "minmax(9rem, 2fr)", required: true },
  { key: "unit", label: "line.unit", kind: "unit", width: "4.5rem" },
  { key: "qty", label: "line.qty", kind: "qty", width: "minmax(6.5rem, 1fr)", required: true },
  { key: "bags", label: "line.bags", kind: "bags", width: "minmax(5rem, 0.6fr)" },
  { key: "weight", label: "line.weight", kind: "weight", width: "minmax(7rem, 0.8fr)" },
];

/** F4 New Outward Gate Pass. Qty can't exceed stock. After saving: a blank OGP with "Saved — Print / View" (client #29). */
export function OgpForm() {
  return (
    <SlipForm slipType="OGP" build={buildOgp} save={api.saveOGP}>
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
      <RemarksField />
    </SlipForm>
  );
}

function buildOgp({ fields, lines }: SlipFormData, base: BaseInput): BuiltInput {
  const filled = lines.filter(([, r]) => !isBlank(r, ["item", "qty", "bags", "weight"]));
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
      lines: filled.map(([, r]) => ({ itemId: r.item ?? "", qty: num(r.qty), weightKg: num(r.weight), bags: num(r.bags) })),
      remarks: opt(fields.remarks),
    },
    lineRows: filled.map(([row]) => row),
  };
}
