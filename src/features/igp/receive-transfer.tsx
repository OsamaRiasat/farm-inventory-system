"use client";

import Link from "next/link";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { SlipForm, type BaseInput, type BuiltInput, type SlipFormData } from "@/components/slip/slip-form";
import { SlipHeader } from "@/components/slip/slip-header";
import { SlipLines, type LineCol } from "@/components/slip/slip-lines";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useFarms, useWaitingTransfers } from "@/lib/api/queries";
import { fmtDate } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import type { MsgId } from "@/lib/i18n";
import { num } from "../form-data";

const cols: LineCol[] = [
  { key: "item", label: "line.item", kind: "item", width: "2fr", readOnly: true },
  { key: "unit", label: "line.unit", kind: "unit", width: "4.5rem" },
  { key: "qtyChallan", label: "line.qtyChallan", kind: "qty", width: "1fr", readOnly: true },
  { key: "qtyReceived", label: "line.qtyReceived", kind: "qty", width: "1fr", required: true },
  { key: "weight", label: "line.weight", kind: "weight", width: "0.8fr" },
];

/** F3 — an IGP filled from the sender's OGP. Only Qty Actual Received is typed. */
export function ReceiveTransfer({ transferId }: { transferId: string }) {
  const { farm } = useCurrentFarm();
  const waiting = useWaitingTransfers(farm.id);
  const farms = useFarms().data ?? [];

  if (waiting.isError) return <LoadError onRetry={() => waiting.refetch()} />;
  if (!waiting.data) return <SkeletonRows rows={4} />;

  const view = waiting.data.find((w) => w.transfer.id === transferId);
  if (!view) {
    return (
      <div className="card flex flex-col items-start gap-3 p-4">
        <Bi id="err.transferClosed" />
        <Link href="/farm" className="btn">
          <Bi id="nav.home" inline />
        </Link>
      </div>
    );
  }

  const { transfer, ogp } = view;
  const facts: { label: MsgId; value: string }[] = [
    { label: "transfer.fromFarm", value: farms.find((f) => f.id === transfer.fromFarmId)?.name ?? "" },
    { label: "transfer.ogpNo", value: ogp.no },
    { label: "transfer.dateSent", value: fmtDate(ogp.date) },
    { label: "igp.driverName", value: ogp.driverName || "—" },
    { label: "ogp.vehicleNo", value: ogp.vehicleNo || "—" },
  ];

  const build = ({ lines }: SlipFormData, base: BaseInput): BuiltInput => ({
    input: {
      ...base,
      transferId: transfer.id,
      lines: lines.map(([, r]) => ({ qtyReceived: num(r.qtyReceived), weightKg: num(r.weight) })),
    },
    lineRows: lines.map(([row]) => row),
  });

  return (
    <SlipForm slipType="IGP" build={build} save={api.receiveTransfer} afterSave="detail">
      <SlipHeader type="IGP" subtitle={<Bi id="slip.receiveTransfer" className="text-muted" />} />
      <dl className="card mb-4 grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-muted">
              <Bi id={f.label} />
            </dt>
            <dd className="num font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>
      <SlipLines
        cols={cols}
        fixed
        receivedAll
        rules={{ shortfall: true, maxSent: true }}
        initial={ogp.lines.map((l) => ({ itemId: l.itemId, values: { qtyChallan: fmtQty(l.qty) } }))}
      />
    </SlipForm>
  );
}
