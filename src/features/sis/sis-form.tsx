"use client";

import { SlipForm, type BaseInput, type BuiltInput, type SlipFormData } from "@/components/slip/slip-form";
import { SlipHeader } from "@/components/slip/slip-header";
import { SlipLines, type LineCol } from "@/components/slip/slip-lines";
import { api } from "@/lib/api";
import { isBlank, num, opt } from "../form-data";
import { FeedMortality } from "./feed-mortality";

const cols: LineCol[] = [
  { key: "item", label: "line.nameOfItem", kind: "item", width: "2fr", required: true },
  { key: "qty", label: "line.quantity", kind: "qty", width: "1fr", required: true },
  { key: "folio", label: "line.ledgerFolio", kind: "folio", width: "5rem" },
  { key: "purpose", label: "line.purpose", kind: "text", width: "1.5fr" },
];

/** F5 New Stock Issue Slip: Feed and Mortality per shed, then items used; summary sheet before saving. */
export function SisForm() {
  return (
    <SlipForm slipType="SIS" build={buildSis} save={api.saveSIS} withSummary>
      <SlipHeader type="SIS" />
      <FeedMortality />
      <SlipLines cols={cols} showStock rules={{ maxStock: true }} />
    </SlipForm>
  );
}

function buildSis({ shed, lines }: SlipFormData, base: BaseInput): BuiltInput {
  const sheds = shed.filter(([, r]) => !isBlank(r, ["feedKg", "mortMale", "mortFemale"]));
  const filled = lines.filter(([, r]) => !isBlank(r, ["item", "qty", "purpose"]));
  return {
    input: {
      ...base,
      shedRows: sheds.map(([, r]) => ({
        shedId: r.shedId,
        feedItemId: r.feedItem ?? "",
        feedKg: num(r.feedKg) ?? 0,
        mortMale: num(r.mortMale) ?? 0,
        mortFemale: num(r.mortFemale) ?? 0,
      })),
      lines: filled.map(([, r]) => ({ itemId: r.item ?? "", qty: num(r.qty), purpose: opt(r.purpose) })),
    },
    lineRows: filled.map(([row]) => row),
    shedRows: sheds.map(([row]) => row),
  };
}
