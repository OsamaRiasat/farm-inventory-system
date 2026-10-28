"use client";

import { SlipForm, type BaseInput, type BuiltInput, type SlipFormData } from "@/components/slip/slip-form";
import { SlipHeader } from "@/components/slip/slip-header";
import { SlipLines, type LineCol } from "@/components/slip/slip-lines";
import { Field, TextInput } from "@/components/ui/field";
import { api } from "@/lib/api";
import { isBlank, num, opt } from "../form-data";
import { IgpSource } from "./igp-source";

const cols: LineCol[] = [
  { key: "item", label: "line.item", kind: "item", width: "2fr", required: true },
  { key: "unit", label: "line.unit", kind: "unit", width: "4.5rem" },
  { key: "qtyChallan", label: "line.qtyChallan", kind: "qty", width: "1fr", required: true },
  { key: "qtyReceived", label: "line.qtyReceived", kind: "qty", width: "1fr", required: true },
  { key: "weight", label: "line.weight", kind: "weight", width: "0.8fr" },
];

/** F2 New Inward Gate Pass. Fields in the paper slip's order. */
export function IgpForm() {
  return (
    <SlipForm slipType="IGP" build={buildIgp} save={api.saveIGP}>
      <SlipHeader type="IGP" />
      <section className="card mb-4 grid gap-4 p-4 sm:grid-cols-3">
        <Field label="igp.biltyNo">
          <TextInput name="biltyNo" />
        </Field>
        <Field label="igp.truckNo">
          <TextInput name="truckNo" />
        </Field>
        <Field label="igp.driverName">
          <TextInput name="driverName" free />
        </Field>
        <div className="sm:col-span-3">
          <IgpSource />
        </div>
        <Field label="igp.demandNo">
          <TextInput name="demandNo" />
        </Field>
        <Field label="igp.challanNo">
          <TextInput name="challanNo" />
        </Field>
        <Field label="igp.challanDate">
          <input type="date" name="challanDate" className="input num" />
        </Field>
      </section>
      <SlipLines cols={cols} rules={{ shortfall: true }} />
    </SlipForm>
  );
}

function buildIgp({ fields, lines }: SlipFormData, base: BaseInput): BuiltInput {
  const filled = lines.filter(([, r]) => !isBlank(r, ["item", "qtyChallan", "qtyReceived", "weight"]));
  return {
    input: {
      ...base,
      source: { kind: fields.sourceKind, ms: fields.ms ?? "" },
      biltyNo: opt(fields.biltyNo),
      truckNo: opt(fields.truckNo),
      driverName: opt(fields.driverName),
      demandNo: opt(fields.demandNo),
      challanNo: opt(fields.challanNo),
      challanDate: opt(fields.challanDate),
      lines: filled.map(([, r]) => ({
        itemId: r.item ?? "",
        qtyChallan: num(r.qtyChallan),
        qtyReceived: num(r.qtyReceived),
        weightKg: num(r.weight),
      })),
    },
    lineRows: filled.map(([row]) => row),
  };
}
