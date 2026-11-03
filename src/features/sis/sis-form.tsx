"use client";

import { SlipForm, type BaseInput, type BuiltInput, type SlipFormData } from "@/components/slip/slip-form";
import { SlipHeader } from "@/components/slip/slip-header";
import { SlipLines, type LineCol } from "@/components/slip/slip-lines";
import { api } from "@/lib/api";
import { isBlank, num, opt } from "../form-data";

// Quantity wide enough for "15,413 KG"; Purpose of Use wide enough for a full reason.
const cols: LineCol[] = [
  { key: "item", label: "line.nameOfItem", kind: "item", width: "minmax(9rem, 2fr)", required: true },
  { key: "qty", label: "line.quantity", kind: "qty", width: "9rem", required: true },
  { key: "folio", label: "line.ledgerFolio", kind: "folio", width: "6rem" },
  { key: "purpose", label: "line.purpose", kind: "text", width: "minmax(9rem, 2fr)" },
];

/** F5 New Stock Issue Slip: items used (feed is an item like any other); summary sheet before saving. */
export function SisForm() {
  return (
    <SlipForm slipType="SIS" build={buildSis} save={api.saveSIS} withSummary>
      <SlipHeader type="SIS" />
      <SlipLines cols={cols} showStock rules={{ maxStock: true }} />
    </SlipForm>
  );
}

function buildSis({ lines }: SlipFormData, base: BaseInput): BuiltInput {
  const filled = lines.filter(([, r]) => !isBlank(r, ["item", "qty", "folio", "purpose"]));
  return {
    input: {
      ...base,
      lines: filled.map(([, r]) => ({
        itemId: r.item ?? "",
        qty: num(r.qty),
        ledgerFolio: opt(r.folio),
        purpose: opt(r.purpose),
      })),
    },
    lineRows: filled.map(([row]) => row),
  };
}
